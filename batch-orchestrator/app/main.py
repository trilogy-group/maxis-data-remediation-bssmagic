"""
Batch Orchestrator - FastAPI Application
=========================================
Autonomous batch remediation service for BSS Magic.

Endpoints:
  GET  /health                      - Health check
  GET  /status                      - Scheduler status + last cycle info
  POST /execute                     - Manually trigger batch execution
  POST /execute/{schedule_id}       - Execute a specific schedule
  POST /remediate                   - Remediate a batch of solutions
  POST /remediate/{solution_id}     - Remediate a single solution (unified API)
  POST /scheduler/start             - Start the automatic scheduler
  POST /scheduler/stop              - Stop the automatic scheduler

Architecture:
  Orchestrator → TMF API (ALB) → PostgreSQL + FDW → Salesforce
  The orchestrator never accesses the database directly.
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, APIRouter
from pydantic import BaseModel

from .config import settings
from .services.tmf_client import TMFClient
from .services.scheduler import Scheduler
from .services.batch_executor import BatchExecutor
from .services.remediation_engine import RemediationEngine, StepResult as EngineStepResult
from .services.oe_executor import OEExecutor
from .services.oe_batch_executor import OEBatchExecutor

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("batch-orchestrator")

# Global state
tmf_client: Optional[TMFClient] = None
scheduler: Optional[Scheduler] = None
scheduler_running = False
scheduler_task: Optional[asyncio.Task] = None

# Observability: last cycle tracking
last_cycle_at: Optional[str] = None
last_cycle_result: Optional[dict] = None
last_cycle_error: Optional[str] = None
total_cycles: int = 0


# =============================================================================
# Background Scheduler Loop
# =============================================================================

async def _scheduler_loop():
    """
    Background asyncio task that polls schedules every N seconds.
    Runs until cancelled or scheduler_running is set to False.
    """
    global scheduler_running, last_cycle_at, last_cycle_result, last_cycle_error, total_cycles

    logger.info(f"Scheduler loop started (interval={settings.scheduler_interval_seconds}s)")

    while scheduler_running:
        cycle_start = datetime.now(timezone.utc)
        try:
            # Run the synchronous scheduler in a thread to avoid blocking the event loop
            job_ids = await asyncio.to_thread(scheduler.check_and_execute)

            last_cycle_at = cycle_start.isoformat()
            last_cycle_result = {
                "jobs_created": len(job_ids),
                "job_ids": job_ids,
                "duration_seconds": round(
                    (datetime.now(timezone.utc) - cycle_start).total_seconds(), 2
                ),
            }
            last_cycle_error = None
            total_cycles += 1

            if job_ids:
                logger.info(f"Scheduler cycle #{total_cycles}: created {len(job_ids)} job(s): {job_ids}")
            else:
                logger.debug(f"Scheduler cycle #{total_cycles}: no schedules due")

        except asyncio.CancelledError:
            logger.info("Scheduler loop cancelled")
            break
        except Exception as e:
            last_cycle_at = cycle_start.isoformat()
            last_cycle_result = None
            last_cycle_error = str(e)
            total_cycles += 1
            logger.error(f"Scheduler cycle #{total_cycles} error: {e}", exc_info=True)

        # Sleep until next cycle (interruptible by task cancellation)
        try:
            await asyncio.sleep(settings.scheduler_interval_seconds)
        except asyncio.CancelledError:
            logger.info("Scheduler loop interrupted during sleep")
            break

    scheduler_running = False
    logger.info("Scheduler loop stopped")


# =============================================================================
# Application Lifecycle
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup, optionally auto-start scheduler."""
    global tmf_client, scheduler, scheduler_running, scheduler_task

    tmf_client = TMFClient(
        base_url=settings.tmf_base_url,
        api_key=settings.tmf_api_key,
    )
    scheduler = Scheduler(tmf_client)

    logger.info(f"Batch Orchestrator started")
    logger.info(f"TMF API: {settings.tmf_base_url}")
    logger.info(f"Scheduler enabled: {settings.scheduler_enabled}")
    logger.info(f"Scheduler interval: {settings.scheduler_interval_seconds}s")

    # Auto-start scheduler if configured
    if settings.scheduler_enabled:
        scheduler_running = True
        scheduler_task = asyncio.create_task(_scheduler_loop())
        logger.info("Scheduler auto-started via SCHEDULER_ENABLED=true")

    yield

    # Shutdown: cancel scheduler if running
    if scheduler_task and not scheduler_task.done():
        scheduler_running = False
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass
        logger.info("Scheduler task cancelled during shutdown")

    logger.info("Batch Orchestrator shutting down")


app = FastAPI(
    title="BSS Magic Batch Orchestrator",
    description="Autonomous batch remediation for Solution Empty (1147) issues",
    version="1.2.0",
    lifespan=lifespan,
)

# CORS middleware -- allow CloudFront-hosted frontend to call orchestrator
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Request/Response Models
# =============================================================================

class RemediateRequest(BaseModel):
    """Request to remediate specific solutions."""
    solution_ids: list[str]
    max_count: Optional[int] = None
    job_name: Optional[str] = "Manual Remediation"


class ExecuteResponse(BaseModel):
    """Response from execution endpoints."""
    job_id: Optional[str] = None
    message: str
    results_count: int = 0
    summary: Optional[dict] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    service: str = "batch-orchestrator"
    version: str = "1.2.0"
    timestamp: str = ""
    scheduler_running: bool = False
    tmf_url: str = ""


class SingleRemediateRequest(BaseModel):
    """Request to remediate a single solution via the unified endpoint."""
    service_problem_id: Optional[str] = None
    skip_validation: bool = False
    sfdc_updates: Optional[dict] = None


class StepDetail(BaseModel):
    """Detail of a single remediation step."""
    action: str
    success: bool
    duration_ms: int = 0
    message: str = ""
    job_id: Optional[str] = None
    status: Optional[str] = None


class SingleRemediateResponse(BaseModel):
    """Response from the unified single-solution remediation endpoint."""
    solution_id: str
    success: bool
    steps: list[StepDetail] = []
    service_problem_updated: bool = False
    total_duration_ms: int = 0
    failed_at: Optional[str] = None
    message: str = ""


# =============================================================================
# Router -- mounted at both "/" and "/api/orchestrator" for dual access
# =============================================================================

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        timestamp=datetime.now(timezone.utc).isoformat(),
        scheduler_running=scheduler_running,
        tmf_url=settings.tmf_base_url,
    )


@router.get("/status")
async def status():
    """Get current scheduler status, last cycle info, and recent activity."""
    return {
        "scheduler_running": scheduler_running,
        "scheduler_interval": settings.scheduler_interval_seconds,
        "scheduler_enabled_config": settings.scheduler_enabled,
        "total_cycles": total_cycles,
        "last_cycle_at": last_cycle_at,
        "last_cycle_result": last_cycle_result,
        "last_cycle_error": last_cycle_error,
        "tmf_url": settings.tmf_base_url,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/execute", response_model=ExecuteResponse)
async def execute_all():
    """Manually trigger one scheduler cycle (check all schedules and execute due ones)."""
    if not scheduler:
        raise HTTPException(status_code=503, detail="Scheduler not initialized")

    job_ids = await asyncio.to_thread(scheduler.check_and_execute)
    return ExecuteResponse(
        message=f"Executed {len(job_ids)} schedule(s)",
        results_count=len(job_ids),
        summary={"job_ids": job_ids},
    )


@router.post("/execute/{schedule_id}", response_model=ExecuteResponse)
async def execute_schedule(schedule_id: str):
    """Execute a specific schedule immediately (bypass time checks)."""
    if not tmf_client:
        raise HTTPException(status_code=503, detail="TMF client not initialized")

    try:
        raw_schedule = tmf_client.get_schedule(schedule_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Schedule not found: {e}")

    # Parse and execute
    from .services.scheduler import _parse_schedule
    schedule = _parse_schedule(raw_schedule)

    if not scheduler:
        raise HTTPException(status_code=503, detail="Scheduler not initialized")

    job_id = await asyncio.to_thread(scheduler._execute_schedule, schedule)

    return ExecuteResponse(
        job_id=job_id,
        message=f"Executed schedule '{schedule.name}'",
        results_count=1 if job_id else 0,
    )


@router.post("/remediate", response_model=ExecuteResponse)
async def remediate(request: RemediateRequest):
    """
    Remediate specific solutions through the 5-step flow.
    Creates a BatchJob to track progress.
    """
    if not tmf_client:
        raise HTTPException(status_code=503, detail="TMF client not initialized")

    if not request.solution_ids:
        raise HTTPException(status_code=400, detail="No solution IDs provided")

    # Create a tracking BatchJob
    job_data = {
        "name": request.job_name or "Manual Remediation",
        "description": f"Manual batch of {len(request.solution_ids)} solutions",
        "category": "SolutionEmpty",
        "requestedQuantity": len(request.solution_ids),
    }

    try:
        tmf_client.create_job(job_data)
        # Find the created job
        jobs = tmf_client.list_jobs()
        job_id = None
        for j in jobs:
            if j.get("name") == job_data["name"] and j.get("state") == "pending":
                job_id = j["id"]
                break
    except Exception as e:
        logger.warning(f"Failed to create tracking BatchJob: {e}")
        job_id = None

    # Resolve solution IDs to ServiceProblem IDs for post-remediation status updates
    try:
        sp_mapping = tmf_client.resolve_service_problems(request.solution_ids)
        logger.info(f"Built SP mapping for {len(sp_mapping)} solutions")
    except Exception as e:
        logger.warning(f"Failed to resolve ServiceProblem IDs: {e}")
        sp_mapping = {}

    # Execute in a thread to avoid blocking
    executor = BatchExecutor(tmf_client, job_id=job_id, service_problem_mapping=sp_mapping)

    def _run():
        return executor.execute_batch(
            request.solution_ids,
            max_count=request.max_count,
        )

    results = await asyncio.to_thread(_run)

    return ExecuteResponse(
        job_id=job_id,
        message=f"Processed {len(results)} solutions",
        results_count=len(results),
        summary=executor.summary.model_dump(),
    )


@router.post("/remediate/{solution_id}", response_model=SingleRemediateResponse)
async def remediate_single(solution_id: str, request: SingleRemediateRequest = SingleRemediateRequest()):
    """
    Remediate a single solution through the full 5-step flow.

    This is the unified remediation endpoint -- used by the frontend
    for manual fixes and callable from CLI/external systems.
    Replaces the 4-step browser-orchestrated flow with a single POST.
    """
    if not solution_id or len(solution_id) < 10:
        raise HTTPException(status_code=400, detail="Invalid solution ID")

    if not tmf_client:
        raise HTTPException(status_code=503, detail="TMF client not initialized")

    engine = RemediationEngine(
        tmf_client,
        initial_delay=settings.remediation_initial_delay,
        poll_interval=settings.remediation_poll_interval,
        max_interval=settings.remediation_max_interval,
        backoff_factor=settings.remediation_backoff_factor,
        max_duration=settings.remediation_max_duration,
    )

    logger.info(f"Single remediation requested for solution {solution_id}")

    result = await asyncio.to_thread(
        engine.remediate,
        solution_id,
        service_problem_id=request.service_problem_id,
        skip_validation=request.skip_validation,
        sfdc_updates=request.sfdc_updates,
    )

    logger.info(
        f"Single remediation {'succeeded' if result.success else 'failed'} for {solution_id} "
        f"in {result.total_duration_ms}ms (failed_at={result.failed_at})"
    )

    return SingleRemediateResponse(
        solution_id=result.solution_id,
        success=result.success,
        steps=[
            StepDetail(
                action=s.action,
                success=s.success,
                duration_ms=s.duration_ms,
                message=s.message,
                job_id=s.job_id,
                status=s.status,
            )
            for s in result.steps
        ],
        service_problem_updated=result.service_problem_updated,
        total_duration_ms=result.total_duration_ms,
        failed_at=result.failed_at,
        message=result.message,
    )


# =============================================================================
# OE Remediation Endpoints (Module 1867 - Partial Data Missing)
# =============================================================================


class OERemediateRequest(BaseModel):
    """Request to batch-remediate OE services."""
    max_count: Optional[int] = 100
    dry_run: bool = False
    job_name: Optional[str] = "OE Remediation"


class OERemediateSingleRequest(BaseModel):
    """Request to remediate a single service's OE data."""
    dry_run: bool = False
    service_problem_id: Optional[str] = None


class OEDiscoverRequest(BaseModel):
    """Request to discover 1867-affected services and create ServiceProblems."""
    max_count: Optional[int] = 200


class OERemediateResponse(BaseModel):
    """Response from OE remediation endpoints."""
    service_id: str
    success: bool
    final_state: str
    fields_patched: list[str] = []
    error: Optional[str] = None
    duration_seconds: float = 0.0


class OEBatchResponse(BaseModel):
    """Response from OE batch remediation."""
    job_id: Optional[str] = None
    message: str
    results_count: int = 0
    summary: Optional[dict] = None


@router.post("/oe/discover")
async def oe_discover(request: OEDiscoverRequest = OEDiscoverRequest()):
    """
    Discover services affected by 1867 (OE Partial Data Missing).

    Queries the main service view (x_has1867Issue = true, no JOINs)
    and creates ServiceProblem records for each.
    """
    if not tmf_client:
        raise HTTPException(status_code=503, detail="TMF client not initialized")

    try:
        services = await asyncio.to_thread(
            tmf_client.list_services_with_filter,
            "x_has1867Issue==true",
            request.max_count or 200,
        )
    except AttributeError:
        services = await asyncio.to_thread(
            tmf_client.discover_oe_services, request.max_count or 200
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Discovery failed: {e}")

    created = 0
    errors = 0
    for svc in services:
        sid = svc.get("serviceId") or svc.get("id", "")
        stype = svc.get("serviceType") or svc.get("x_serviceType", "")
        if not sid:
            continue
        try:
            tmf_client.create_oe_service_problem(sid, stype, ["pending-analysis"])
            created += 1
        except Exception as e:
            logger.warning(f"Failed to create ServiceProblem for {sid}: {e}")
            errors += 1

    return {
        "message": f"Discovered {len(services)} services, created {created} ServiceProblems",
        "discovered": len(services),
        "problems_created": created,
        "errors": errors,
    }


@router.post("/oe/remediate", response_model=OEBatchResponse)
async def oe_remediate_batch(request: OERemediateRequest = OERemediateRequest()):
    """
    Batch OE remediation: discover pending services from ServiceProblem
    and process them through the 4-step flow.
    """
    if not tmf_client:
        raise HTTPException(status_code=503, detail="TMF client not initialized")

    entries = await asyncio.to_thread(
        tmf_client.discover_oe_services, request.max_count or 100
    )

    if not entries:
        return OEBatchResponse(message="No pending OE services found", results_count=0)

    job_data = {
        "name": request.job_name or "OE Remediation",
        "description": f"OE batch of {len(entries)} services",
        "category": "PartialDataMissing",
        "requestedQuantity": len(entries),
    }

    job_id = None
    try:
        tmf_client.create_job(job_data)
        jobs = tmf_client.list_jobs()
        for j in jobs:
            if j.get("name") == job_data["name"] and j.get("state") == "pending":
                job_id = j["id"]
                break
    except Exception as e:
        logger.warning(f"Failed to create tracking BatchJob: {e}")

    executor = OEBatchExecutor(tmf_client, job_id=job_id, dry_run=request.dry_run)

    results = await asyncio.to_thread(
        executor.execute_batch, entries, request.max_count
    )

    return OEBatchResponse(
        job_id=job_id,
        message=f"Processed {len(results)} OE services",
        results_count=len(results),
        summary=executor.summary.model_dump(),
    )


@router.post("/oe/remediate/{service_id}", response_model=OERemediateResponse)
async def oe_remediate_single(
    service_id: str,
    request: OERemediateSingleRequest = OERemediateSingleRequest(),
):
    """
    Remediate a single service's OE data through the 4-step flow.

    Steps:
      1. Fetch raw OE data from Salesforce
      2. Analyze + patch attachment JSON in memory
      3. Persist patched attachment
      4. Trigger SM Service sync

    Use dry_run=true to analyze without persisting.
    """
    if not service_id or len(service_id) < 10:
        raise HTTPException(status_code=400, detail="Invalid service ID")

    if not tmf_client:
        raise HTTPException(status_code=503, detail="TMF client not initialized")

    executor = OEExecutor(tmf_client)

    result = await asyncio.to_thread(
        executor.remediate, service_id, dry_run=request.dry_run
    )

    if request.service_problem_id and not request.dry_run:
        try:
            sp_status = "resolved" if result.final_state.value == "REMEDIATED" else "pending"
            tmf_client.update_service_problem(
                request.service_problem_id,
                sp_status,
                result.final_state.value,
                result.error or "",
            )
        except Exception as e:
            logger.warning(f"Failed to update ServiceProblem: {e}")

    return OERemediateResponse(
        service_id=result.service_id,
        success=result.final_state.value in ("REMEDIATED", "NOT_IMPACTED", "VALIDATED"),
        final_state=result.final_state.value,
        fields_patched=result.fields_patched,
        error=result.error,
        duration_seconds=result.duration_seconds,
    )


@router.post("/scheduler/start")
async def start_scheduler():
    """Start the automatic scheduler loop."""
    global scheduler_running, scheduler_task

    if scheduler_running and scheduler_task and not scheduler_task.done():
        return {"message": "Scheduler already running", "interval": settings.scheduler_interval_seconds}

    scheduler_running = True
    scheduler_task = asyncio.create_task(_scheduler_loop())

    return {
        "message": "Scheduler started",
        "interval": settings.scheduler_interval_seconds,
    }


@router.post("/scheduler/stop")
async def stop_scheduler():
    """Stop the automatic scheduler loop."""
    global scheduler_running, scheduler_task

    if not scheduler_running:
        return {"message": "Scheduler already stopped"}

    scheduler_running = False

    if scheduler_task and not scheduler_task.done():
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass

    scheduler_task = None
    return {"message": "Scheduler stopped"}


# =============================================================================
# Mount router at both root and /api/orchestrator
# =============================================================================

# Root mount: for direct container access and ALB header-based routing
app.include_router(router)

# Prefixed mount: for CloudFront path-based routing (/api/orchestrator/*)
app.include_router(router, prefix="/api/orchestrator")


# =============================================================================
# Entry point
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
