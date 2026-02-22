"""
WorkOrder Database Service
Connects to PostgreSQL tmf.workOrder and tmf.workOrderSchedule tables
"""
import os
import asyncpg
from typing import Optional, List, Dict, Any
from datetime import datetime
import json

# PostgreSQL connection settings - use environment or defaults
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
DB_NAME = os.getenv("POSTGRES_DB", "bssmagic")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")

# Connection pool
_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Get or create the connection pool"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            min_size=1,
            max_size=5
        )
    return _pool


async def close_pool():
    """Close the connection pool"""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


# ==========================================
# WorkOrderSchedule CRUD Operations
# ==========================================

async def list_schedules(category: Optional[str] = None, is_active: Optional[bool] = None, limit: int = 100) -> List[Dict]:
    """List work order schedules with optional filtering"""
    pool = await get_pool()
    
    query = 'SELECT * FROM tmf."workOrderSchedule" WHERE 1=1'
    params = []
    param_count = 0
    
    if category:
        param_count += 1
        query += f' AND category = ${param_count}'
        params.append(category)
    
    if is_active is not None:
        param_count += 1
        query += f' AND "isActive" = ${param_count}'
        params.append(is_active)
    
    query += f' ORDER BY "creationDate" DESC LIMIT ${param_count + 1}'
    params.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return [dict(row) for row in rows]


async def get_schedule(schedule_id: str) -> Optional[Dict]:
    """Get a single schedule by ID"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            'SELECT * FROM tmf."workOrderSchedule" WHERE id = $1',
            schedule_id
        )
        return dict(row) if row else None


async def create_schedule(schedule: Dict) -> Dict:
    """Create a new schedule"""
    pool = await get_pool()
    
    schedule_id = schedule.get('id') or f"sched-{int(datetime.now().timestamp() * 1000)}"
    now = datetime.now()
    
    async with pool.acquire() as conn:
        await conn.execute('''
            INSERT INTO tmf."workOrderSchedule" (
                id, name, description, "isActive", category, 
                "recurrencePattern", "recurrenceDays", "windowStartTime", "windowEndTime",
                "maxBatchSize", "selectionCriteria", "totalExecutions", 
                "successfulExecutions", "failedExecutions", "creationDate", "lastUpdate"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ''',
            schedule_id,
            schedule.get('name', 'New Schedule'),
            schedule.get('description'),
            schedule.get('isActive', True),
            schedule.get('category', ''),
            schedule.get('recurrencePattern', 'daily'),
            schedule.get('recurrenceDays'),
            schedule.get('windowStartTime', '00:00:00'),
            schedule.get('windowEndTime', '06:00:00'),
            schedule.get('maxBatchSize', 100),
            json.dumps(schedule.get('selectionCriteria', {})),
            0, 0, 0, now, now
        )
    
    return await get_schedule(schedule_id)


async def update_schedule(schedule_id: str, updates: Dict) -> Optional[Dict]:
    """Update an existing schedule"""
    pool = await get_pool()
    
    # Build dynamic UPDATE query
    set_clauses = []
    params = []
    param_count = 0
    
    for key, value in updates.items():
        if key not in ['id', 'creationDate']:  # Don't update these
            param_count += 1
            if key == 'selectionCriteria':
                set_clauses.append(f'"{key}" = ${param_count}')
                params.append(json.dumps(value) if isinstance(value, dict) else value)
            else:
                set_clauses.append(f'"{key}" = ${param_count}')
                params.append(value)
    
    if not set_clauses:
        return await get_schedule(schedule_id)
    
    # Add lastUpdate
    param_count += 1
    set_clauses.append(f'"lastUpdate" = ${param_count}')
    params.append(datetime.now())
    
    # Add schedule_id for WHERE clause
    param_count += 1
    params.append(schedule_id)
    
    query = f'UPDATE tmf."workOrderSchedule" SET {", ".join(set_clauses)} WHERE id = ${param_count}'
    
    async with pool.acquire() as conn:
        await conn.execute(query, *params)
    
    return await get_schedule(schedule_id)


async def delete_schedule(schedule_id: str) -> bool:
    """Delete a schedule"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            'DELETE FROM tmf."workOrderSchedule" WHERE id = $1',
            schedule_id
        )
        return 'DELETE 1' in result


# ==========================================
# WorkOrder CRUD Operations
# ==========================================

async def list_work_orders(
    category: Optional[str] = None, 
    state: Optional[str] = None,
    limit: int = 100
) -> List[Dict]:
    """List work orders with optional filtering"""
    pool = await get_pool()
    
    query = 'SELECT * FROM tmf."workOrder" WHERE 1=1'
    params = []
    param_count = 0
    
    if category:
        param_count += 1
        query += f' AND category = ${param_count}'
        params.append(category)
    
    if state:
        param_count += 1
        query += f' AND state = ${param_count}'
        params.append(state)
    
    query += f' ORDER BY "creationDate" DESC LIMIT ${param_count + 1}'
    params.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return [dict(row) for row in rows]


async def get_work_order(work_order_id: str) -> Optional[Dict]:
    """Get a single work order by ID"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            'SELECT * FROM tmf."workOrder" WHERE id = $1',
            work_order_id
        )
        return dict(row) if row else None


async def create_work_order(work_order: Dict) -> Dict:
    """Create a new work order"""
    pool = await get_pool()
    
    work_order_id = work_order.get('id') or f"wo-{int(datetime.now().timestamp() * 1000)}"
    now = datetime.now()
    
    summary = {
        "total": 0,
        "successful": 0,
        "failed": 0,
        "skipped": 0,
        "pending": work_order.get('requestedQuantity', 0)
    }
    
    async with pool.acquire() as conn:
        await conn.execute('''
            INSERT INTO tmf."workOrder" (
                id, name, description, state, category, priority,
                "scheduledStartDate", "requestedQuantity", "actualQuantity",
                "x_summary", "x_recurrencePattern", "x_isRecurrent",
                "x_parentScheduleId", "creationDate", "lastUpdate"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ''',
            work_order_id,
            work_order.get('name', 'New Work Order'),
            work_order.get('description'),
            work_order.get('state', 'pending'),
            work_order.get('category', ''),
            work_order.get('priority', 5),
            work_order.get('scheduledStartDate'),
            work_order.get('requestedQuantity', 0),
            0,
            json.dumps(summary),
            work_order.get('x_recurrencePattern', 'once'),
            work_order.get('x_isRecurrent', False),
            work_order.get('x_parentScheduleId'),
            now, now
        )
    
    return await get_work_order(work_order_id)


async def update_work_order(work_order_id: str, updates: Dict) -> Optional[Dict]:
    """Update an existing work order"""
    pool = await get_pool()
    
    set_clauses = []
    params = []
    param_count = 0
    
    for key, value in updates.items():
        if key not in ['id', 'creationDate']:
            param_count += 1
            if key == 'x_summary':
                set_clauses.append(f'"{key}" = ${param_count}')
                params.append(json.dumps(value) if isinstance(value, dict) else value)
            else:
                set_clauses.append(f'"{key}" = ${param_count}')
                params.append(value)
    
    if not set_clauses:
        return await get_work_order(work_order_id)
    
    param_count += 1
    set_clauses.append(f'"lastUpdate" = ${param_count}')
    params.append(datetime.now())
    
    param_count += 1
    params.append(work_order_id)
    
    query = f'UPDATE tmf."workOrder" SET {", ".join(set_clauses)} WHERE id = ${param_count}'
    
    async with pool.acquire() as conn:
        await conn.execute(query, *params)
    
    return await get_work_order(work_order_id)


async def delete_work_order(work_order_id: str) -> bool:
    """Delete a work order"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            'DELETE FROM tmf."workOrder" WHERE id = $1',
            work_order_id
        )
        return 'DELETE 1' in result
