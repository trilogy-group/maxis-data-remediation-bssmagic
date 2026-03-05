"""
IoT QBS Orchestrator - Glue layer between API endpoints and pure executor functions.

Manages:
  - Salesforce OAuth token acquisition
  - Apex REST API calls (APIs 1-4) via httpx
  - State machine transitions
  - Wiring API responses into pure functions from iot_qbs_executor.py

This is the "journey" packaged as a class: detect held orchestrations,
load data, validate, patch, revalidate, release.
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

import httpx

from ..models.schemas import (
    IoTQBSRemediationState,
    IoTQBSResult,
    IoTQBSSafetyCheck,
    IoTQBSBatchSummary,
    ValidationFinding,
)
from .iot_qbs_executor import (
    build_truth_table,
    check_safety,
    identify_parent_pcs,
    validate_services,
    build_patch_payloads,
    check_revalidation,
    summarize_findings,
    summarize_payloads,
)

logger = logging.getLogger(__name__)

SF_LOGIN_URL = "https://test.salesforce.com"
SF_USERNAME = "vinay.jagwani@trilogy.com.fdrv2"
SF_PASSWORD = "Jan@2026"
SF_SECURITY_TOKEN = "DI0yaU7IwU2gUSKCmNj2oeG3f"
SF_CLIENT_ID = (
    "3MVG9z6NAroNkeMmnl9r_59R1wnsF_nJV4iy4RDGeZjhveXZaSWYDsd2CHl8"
    ".0Jy4R9s0KozeoTI2FuU4XVDm"
)
SF_CLIENT_SECRET = (
    "5BECD33105C3FEC6699A0028BB9F891F825E1F35A4D576E7FC491C30BABD5D0E"
)

APEX_BASE = "/services/apexrest/api/v1/iot-qbs-orders"

DETECTION_SOQL = (
    "SELECT Id, Name, CSPOFA__Process_On_Hold__c, "
    "CSPOFA__Orchestration_Process_Template__r.Name, Order__c, "
    "CreatedDate, LastModifiedDate "
    "FROM CSPOFA__Orchestration_Process__c "
    "WHERE CSPOFA__Process_On_Hold__c = true "
    "AND CSPOFA__Orchestration_Process_Template__r.Name = "
    "'Order Fulfillment Process IOT' "
    "ORDER BY CreatedDate DESC "
    "LIMIT {limit}"
)


@dataclass
class SalesforceSession:
    instance_url: str = ""
    access_token: str = ""
    acquired_at: float = 0.0


class IoTQBSOrchestrator:
    """Orchestrates the full IoT QBS remediation flow using direct Apex API calls."""

    def __init__(self) -> None:
        self._session: Optional[SalesforceSession] = None
        self._client: Optional[httpx.Client] = None

    def _ensure_auth(self) -> httpx.Client:
        if self._session and (time.time() - self._session.acquired_at) < 3000:
            if self._client:
                return self._client

        logger.info("Acquiring Salesforce OAuth token")
        resp = httpx.post(
            f"{SF_LOGIN_URL}/services/oauth2/token",
            data={
                "grant_type": "password",
                "client_id": SF_CLIENT_ID,
                "client_secret": SF_CLIENT_SECRET,
                "username": SF_USERNAME,
                "password": SF_PASSWORD + SF_SECURITY_TOKEN,
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        body = resp.json()

        self._session = SalesforceSession(
            instance_url=body["instance_url"],
            access_token=body["access_token"],
            acquired_at=time.time(),
        )

        if self._client:
            self._client.close()

        self._client = httpx.Client(
            base_url=self._session.instance_url,
            headers={
                "Authorization": f"Bearer {self._session.access_token}",
                "Content-Type": "application/json",
            },
            timeout=60.0,
        )
        logger.info(f"Authenticated to {self._session.instance_url}")
        return self._client

    def close(self) -> None:
        if self._client:
            self._client.close()
            self._client = None

    # -------------------------------------------------------------------------
    # Detection: find held IoT orchestrations via SOQL
    # -------------------------------------------------------------------------

    def detect_held_orchestrations(self, max_count: int = 50) -> list[dict]:
        """Query Salesforce for held IoT orchestrations and enrich with API 1 data."""
        client = self._ensure_auth()

        soql = DETECTION_SOQL.format(limit=max_count)
        logger.info(f"Running detection SOQL (limit={max_count})")
        resp = client.get("/services/data/v59.0/query", params={"q": soql})
        resp.raise_for_status()
        records = resp.json().get("records", [])
        logger.info(f"Detection found {len(records)} held orchestrations")

        results = []
        for rec in records:
            orch_id = rec.get("Id", "")
            name = rec.get("Name", "")
            order_id = rec.get("Order__c", "")
            created = rec.get("CreatedDate", "")

            summary = {
                "orchestration_process_id": orch_id,
                "name": name,
                "order_id": order_id,
                "created_date": created,
                "pc_count": 0,
                "service_count": 0,
                "mismatch_count": 0,
                "is_safe": False,
            }

            try:
                api1 = self._call_api1(client, orch_id)
                if api1.get("success"):
                    pcs = api1.get("productConfigurations", [])
                    services = api1.get("services", [])
                    summary["pc_count"] = len(pcs)
                    summary["service_count"] = len(services)

                    quick = self._quick_validate(client, orch_id, api1)
                    summary["mismatch_count"] = quick["mismatch_count"]
                    summary["is_safe"] = quick["is_safe"]
            except Exception as e:
                logger.warning(f"API 1 enrichment failed for {orch_id}: {e}")

            results.append(summary)

        return results

    def _quick_validate(
        self, client: httpx.Client, orch_id: str, api1: dict
    ) -> dict:
        """Run quick validation (API 2 + truth table) to count mismatches."""
        pcs = api1.get("productConfigurations", [])
        services = api1.get("services", [])

        pc_oe_data: dict[str, list] = {}
        pc_config_data: dict[str, dict] = {}

        for pc in pcs:
            pc_id = pc["pcId"]
            try:
                api2 = self._call_api2(
                    client, orch_id, pc_id,
                    pc.get("guid", ""), pc.get("solutionId", ""),
                )
                pc_oe_data[pc_id] = api2.get("oeData", [])
                pc_config_data[pc_id] = api2.get("configData", {})
            except Exception as e:
                logger.warning(f"API 2 failed for PC {pc_id}: {e}")

        parent_ids = identify_parent_pcs(pcs, pc_oe_data, services)
        truth_table, dupes = build_truth_table(pc_oe_data)
        safety = check_safety(services, truth_table, dupes, pc_oe_data, parent_ids)
        findings = validate_services(
            services, truth_table, pc_oe_data, pc_config_data, parent_ids
        )

        return {
            "mismatch_count": len(findings),
            "is_safe": safety.is_safe,
        }

    # -------------------------------------------------------------------------
    # Full remediation for a single orchestration
    # -------------------------------------------------------------------------

    def remediate_single(
        self, orch_id: str, dry_run: bool = False
    ) -> IoTQBSResult:
        """Execute the full 7-step remediation for one orchestration process."""
        start = time.time()
        client = self._ensure_auth()

        state = IoTQBSRemediationState.RECEIVED
        history: list[tuple[str, str, str]] = []

        def transition(new_state: IoTQBSRemediationState, reason: str = "") -> None:
            nonlocal state
            history.append((state.value, new_state.value, reason))
            state = new_state
            logger.info(f"[{orch_id}] {state.value}: {reason}")

        result = IoTQBSResult(
            orchestration_process_id=orch_id,
            final_state=state,
        )

        try:
            # Step 1: RECEIVED -> LOADING_DATA
            transition(IoTQBSRemediationState.LOADING_DATA, "Calling API 1 discovery")
            api1 = self._call_api1(client, orch_id)
            if not api1.get("success"):
                transition(
                    IoTQBSRemediationState.FAILED,
                    f"API 1 returned success=false: {api1.get('message', '')}",
                )
                return self._finalize(result, state, history, start)

            pcs = api1.get("productConfigurations", [])
            services = api1.get("services", [])
            result.order_id = api1.get("orderId")
            result.pc_count = len(pcs)
            result.service_count = len(services)

            # Load per-PC data (API 2)
            pc_oe_data: dict[str, list] = {}
            pc_config_data: dict[str, dict] = {}

            for pc in pcs:
                pc_id = pc["pcId"]
                api2 = self._call_api2(
                    client, orch_id, pc_id,
                    pc.get("guid", ""), pc.get("solutionId", ""),
                )
                pc_oe_data[pc_id] = api2.get("oeData", [])
                pc_config_data[pc_id] = api2.get("configData", {})

            # Step 2: LOADING_DATA -> VALIDATING
            transition(IoTQBSRemediationState.VALIDATING, "Building truth table")
            parent_ids = identify_parent_pcs(pcs, pc_oe_data, services)
            truth_table, dupes = build_truth_table(pc_oe_data)

            safety = check_safety(
                services, truth_table, dupes, pc_oe_data, parent_ids
            )
            result.safety_check = safety

            if not safety.is_safe:
                transition(
                    IoTQBSRemediationState.FAILED,
                    f"Unsafe: orphans={safety.orphan_sims}, "
                    f"dupes={safety.duplicate_sims}, "
                    f"emptyOE={safety.empty_oe_pcs}",
                )
                result.failure_stage = "VALIDATING"
                return self._finalize(result, state, history, start)

            findings = validate_services(
                services, truth_table, pc_oe_data, pc_config_data, parent_ids
            )
            result.findings = findings
            result.mismatch_count = len(findings)

            if not findings:
                transition(
                    IoTQBSRemediationState.RELEASING,
                    "No mismatches found, releasing directly",
                )
            else:
                transition(
                    IoTQBSRemediationState.SAFE_TO_PATCH,
                    summarize_findings(findings),
                )

                # Step 3: SAFE_TO_PATCH -> PATCHING
                payloads = build_patch_payloads(
                    findings, pc_oe_data, pc_config_data
                )
                logger.info(
                    f"[{orch_id}] Patch payloads: {summarize_payloads(payloads)}"
                )

                if dry_run:
                    transition(
                        IoTQBSRemediationState.FAILED,
                        f"DRY RUN: would patch {summarize_payloads(payloads)}",
                    )
                    result.failure_stage = "DRY_RUN"
                    return self._finalize(result, state, history, start)

                transition(IoTQBSRemediationState.PATCHING, "Calling API 3")
                all_patches = []
                for _pc_id, svc_patches in payloads.items():
                    all_patches.extend(svc_patches)

                patch_resp = self._call_api3(client, orch_id, all_patches)
                patched_ids = [p["serviceId"] for p in all_patches]
                result.patched_services = patched_ids

                if not patch_resp.get("success", False):
                    transition(
                        IoTQBSRemediationState.FAILED,
                        f"API 3 error: {patch_resp.get('message', '')}",
                    )
                    result.failure_stage = "PATCHING"
                    return self._finalize(result, state, history, start)

                # Step 4: PATCHING -> REVALIDATING
                transition(
                    IoTQBSRemediationState.REVALIDATING,
                    "Re-fetching via API 1 to confirm",
                )
                api1_after = self._call_api1(client, orch_id)
                services_after = api1_after.get("services", [])
                remaining = check_revalidation(
                    services_after, truth_table, parent_ids
                )

                if remaining:
                    transition(
                        IoTQBSRemediationState.FAILED,
                        f"Revalidation found {len(remaining)} remaining mismatches",
                    )
                    result.failure_stage = "REVALIDATING"
                    return self._finalize(result, state, history, start)

                transition(
                    IoTQBSRemediationState.RELEASING,
                    "Revalidation passed",
                )

            # Step 5: RELEASING -> RELEASED
            release_resp = self._call_api4(client, orch_id)
            if not release_resp.get("success", False):
                transition(
                    IoTQBSRemediationState.FAILED,
                    f"API 4 error: {release_resp.get('message', '')}",
                )
                result.failure_stage = "RELEASING"
                return self._finalize(result, state, history, start)

            transition(IoTQBSRemediationState.RELEASED, "Orchestration released")

        except httpx.HTTPStatusError as e:
            transition(
                IoTQBSRemediationState.FAILED,
                f"HTTP {e.response.status_code}: {str(e)[:200]}",
            )
            result.failure_stage = state.value
            result.error = str(e)[:500]
        except Exception as e:
            transition(IoTQBSRemediationState.FAILED, str(e)[:300])
            result.failure_stage = state.value
            result.error = str(e)[:500]

        return self._finalize(result, state, history, start)

    # -------------------------------------------------------------------------
    # Apex API helpers
    # -------------------------------------------------------------------------

    def _call_api1(self, client: httpx.Client, orch_id: str) -> dict:
        resp = client.get(f"{APEX_BASE}/{orch_id}")
        resp.raise_for_status()
        return resp.json()

    def _call_api2(
        self,
        client: httpx.Client,
        orch_id: str,
        pc_id: str,
        guid: str,
        solution_id: str,
    ) -> dict:
        resp = client.get(
            f"{APEX_BASE}/{orch_id}/pc-data/{pc_id}",
            params={"guid": guid, "solutionId": solution_id},
        )
        resp.raise_for_status()
        return resp.json()

    def _call_api3(
        self,
        client: httpx.Client,
        orch_id: str,
        services: list[dict],
    ) -> dict:
        resp = client.put(
            f"{APEX_BASE}/{orch_id}/services",
            json={"services": services},
        )
        resp.raise_for_status()
        return resp.json()

    def _call_api4(self, client: httpx.Client, orch_id: str) -> dict:
        resp = client.post(f"{APEX_BASE}/{orch_id}/release")
        resp.raise_for_status()
        return resp.json()

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    @staticmethod
    def _finalize(
        result: IoTQBSResult,
        state: IoTQBSRemediationState,
        history: list[tuple[str, str, str]],
        start: float,
    ) -> IoTQBSResult:
        result.final_state = state
        result.state_history = history
        result.duration_seconds = round(time.time() - start, 2)
        return result
