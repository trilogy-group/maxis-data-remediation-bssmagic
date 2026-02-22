# Maxis Data Remediation - BSS Magic Runtime Architecture

**Version:** 2.0
**Last Updated:** February 22, 2026
**Environment:** Maxis Production

---

## System Overview

The BSS Magic Runtime is a unified middleware solution that enables **TMF Open API** exposure for **CloudSense/Salesforce** data, with automated remediation capabilities for data synchronization issues.

### Key Capabilities

- **TMF API Exposure**: CloudSense/Salesforce objects exposed as TMF-compliant REST APIs
- **Unified Remediation**: Single API for manual and scheduled remediation operations
- **Real-time Dashboards**: React-based UI for monitoring and operations
- **OE Data Management**: Direct access to CloudSense internal database via TMF API

---

## Simplified Architecture

```
┌────────────┐
│    User    │
└──────┬─────┘
       │
       ▼
┌─────────────────────┐
│   Dashboard (3000)  │  Next.js 15 + React + TanStack Query
└──────┬──────────────┘
       │
       ├──► Read Operations (GET /api/tmf-api/*)
       │
       └──► Write Operations (POST /api/orchestrator/*) ───┐
                                                            │
            ┌───────────────────────────────────────────────┘
            │
            ▼
       ┌────────────────────┐
       │ Batch Orchestrator │  FastAPI (ECS - Port 8082)
       │      (8082)        │
       └────────┬───────────┘
                │
                └──► Both paths converge here
                         │
                         ▼
                ┌─────────────────────┐
                │ Application Load    │  Public Endpoint
                │ Balancer (ALB)      │  bssmagic-alb-***.elb.amazonaws.com
                └─────────┬───────────┘
                          │
                          ▼
                ┌─────────────────────┐
                │  BSS Magic Runtime  │  TMF Server + PostgreSQL + FDW
                │    (ECS Container)  │
                └─────────┬───────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │  Salesforce  │  CloudSense Objects + Heroku OE DB
                   │    (Maxis)   │
                   └──────────────┘
```

---

## Components

### 1. Dashboard (Port 3000)

| Property | Value |
|----------|-------|
| **Technology** | Next.js 15, React 19, TanStack Query |
| **Location** | `dashboard/` |
| **Deployment** | AWS CloudFront + S3 (Production) |

**Features:**
- Service and product monitoring
- Issue detection (1867 OE data missing)
- Manual remediation trigger (via Batch Orchestrator)
- ServiceProblem tracking
- PIC Email lookup

**API Routes:**

*Proxy Routes (forward to external services):*
- `/api/tmf-api/[...slug]` - Proxy to TMF Runtime (all TMF API endpoints)
- `/api/orchestrator/[...path]` - Proxy to Batch Orchestrator (remediation endpoints)
- `/api/gateway-cloudsense/[...path]` - Proxy to CloudSense JS Gateway (optional)

*Internal Routes (dashboard-specific logic):*
- `/api/solutions/failed-migration` - Query solutions with migration issues
- `/api/solutions/fix` - Trigger solution remediation (uses Batch Orchestrator)
- `/api/service-problem` - CRUD operations for ServiceProblem records
- `/api/work-order` - Work order management
- `/api/task` - Task management
- `/api/service-attachment/{serviceId}` - Get service attachment data
- `/api/direct/shopping-cart` - Direct PostgreSQL access (workaround for JSONB bug)

---

### 2. Batch Orchestrator (Port 8082)

| Property | Value |
|----------|-------|
| **Technology** | Python 3.9, FastAPI, asyncio |
| **Location** | `batch-orchestrator/` |
| **Deployment** | AWS ECS Fargate |

**Responsibilities:**
- **Manual remediation** - User-triggered fixes from dashboard
- **Scheduled remediation** - Automated batch processing
- **Unified API** - Single endpoint for all remediation operations
- **TMF-only access** - All operations through TMF API (no direct Apex)

**Key Endpoints:**

*Note: All endpoints accessible at root path (e.g., `/remediate/{id}`) and via Dashboard proxy (`/api/orchestrator/remediate/{id}`)*

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/remediate/{solution_id}` | POST | Remediate single solution (1147 issue) |
| `/remediate` | POST | Bulk remediation for multiple solutions |
| `/oe/discover` | POST | Discover services with OE data issues (1867) |
| `/oe/remediate` | POST | Bulk OE remediation workflow |
| `/oe/remediate/{service_id}` | POST | Remediate single OE service (1867 issue) |
| `/execute/{schedule_id}` | POST | Execute specific schedule |
| `/scheduler/start` | POST | Start automatic scheduler |
| `/scheduler/stop` | POST | Stop automatic scheduler |
| `/status` | GET | Scheduler status and last cycle info |

**Remediation Flow (5 steps):**
1. **Detect** - Query TMF API for affected solutions
2. **Analyze** - Identify missing/incorrect data
3. **Patch** - Update via TMF API REST FDW
4. **Persist** - Write to CloudSense Heroku DB
5. **Sync** - Update Salesforce objects

---

### 3. CloudSense JS Gateway (Port 8080) - Optional

| Property | Value |
|----------|-------|
| **Technology** | Python 3.9, FastAPI, Playwright |
| **Location** | `gateways/cloudsense-js-gateway/` |
| **Deployment** | AWS ECS (optional) |

**Responsibilities:**
- Browser automation for CloudSense Solution Console
- Load baskets and configurations
- Update OE attributes via JS API (fallback method)
- Verify OE data integrity

**Key Endpoints:**
| Endpoint | Method | Required Parameters | Purpose |
|----------|--------|---------------------|---------|
| `/api/configurations` | POST | `basket_id`, `solution_name` | Load basket configurations |
| `/api/oe/update` | POST | `basket_id`, `solution_name`, `attributes[]` | Update OE attributes via CloudSense JS |
| `/api/verify-oe` | POST | `basket_id`, `solution_name` | Verify OE data completeness |

**Important:** All endpoints require `solution_name` parameter (not documented previously but required by implementation).

**Note:** This is a **fallback option** when TMF API REST FDW is not available. Primary path is through Batch Orchestrator.

---

### 4. BSS Magic Runtime (AWS ECS)

| Property | Value |
|----------|-------|
| **URL** | `http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com` |
| **API Key** | `X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282` |
| **Technology** | Java TMF Server, PostgreSQL 14, Salesforce FDW |
| **Deployment** | AWS ECS Fargate (Singapore: ap-southeast-1) |

**Infrastructure:**
| Component | AWS Service | Details |
|-----------|-------------|---------|
| Container | ECS Fargate | Cluster: `bssmagic-cluster`, Service: `bssmagic-service` |
| Load Balancer | ALB | Public endpoint for API access |
| Storage | EFS | PostgreSQL data persistence |
| Secrets | Secrets Manager | Salesforce credentials |
| Logs | CloudWatch | `/ecs/bssmagic-runtime` |

**TMF APIs Exposed:**

| API | Endpoint | CloudSense Object | View File |
|-----|----------|-------------------|-----------|
| TMF637 Product | `/tmf-api/productInventory/v5/product` | csord__Solution__c | `product.sql` |
| TMF638 Service | `/tmf-api/serviceInventoryManagement/v5/service` | csord__Service__c | `service.sql` |
| TMF663 ShoppingCart | `/tmf-api/shoppingCart/v5/shoppingCart` | cscfga__Product_Basket__c | `shoppingCart.sql` |
| TMF666 BillingAccount | `/tmf-api/accountManagement/v5/billingAccount` | csconta__Billing_Account__c | `billingAccount.sql` |
| TMF632 Individual | `/tmf-api/partyManagement/v5/individual` | Contact | `individual.sql` |
| TMF656 ServiceProblem | `/tmf-api/serviceProblemManagement/v5/serviceProblem` | Internal table | `serviceProblem.sql` |

**Custom Views:** 49 SQL views in `/runtime/views/` mapping CloudSense to TMF

---

## Data Flow

### Remediation Flow (Unified Approach)

```
User clicks "Fix"
     ↓
Dashboard (3000)
     ↓
POST /remediate/{solution_id}
     ↓
Batch Orchestrator (8082)
     ↓
┌────────────────────────────────────┐
│  5-Step Remediation Process:       │
│  1. Detect issues via TMF API      │
│  2. Analyze data gaps               │
│  3. Patch via REST FDW              │
│  4. Persist to Heroku DB            │
│  5. Sync Salesforce objects         │
└────────────────────────────────────┘
     ↓
TMF Runtime (ALB)
     ↓
PostgreSQL FDW
     ↓
Salesforce REST API
     ↓
CloudSense Objects Updated
```

### Query Flow (Read Operations)

```
User browses data
     ↓
Dashboard (3000)
     ↓
GET /tmf-api/service?...
     ↓
TMF Runtime (ALB)
     ↓
PostgreSQL + FDW
     ↓
SOQL Query → Salesforce
     ↓
Results returned to UI
```

---

## Deployment Architecture

### AWS Production Environment

```
┌──────────────────────────────────────────────────────┐
│                      AWS VPC                          │
│  ┌────────────────────────────────────────────────┐  │
│  │              PUBLIC SUBNET                      │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │      Application Load Balancer (ALB)     │  │  │
│  │  │  • /tmf-api/*  → BSS Magic Runtime       │  │  │
│  │  │  • /remediate/* → Batch Orchestrator     │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │             PRIVATE SUBNET                      │  │
│  │  ┌─────────────────┐  ┌───────────────────┐   │  │
│  │  │  ECS Service    │  │   ECS Service     │   │  │
│  │  │  BSS Runtime    │  │  Batch Orch.      │   │  │
│  │  │  (TMF + PG)     │  │  (8082)           │   │  │
│  │  └─────────────────┘  └───────────────────┘   │  │
│  │                                                 │  │
│  │  ┌──────────────┐     ┌───────────────┐       │  │
│  │  │     EFS      │     │    Secrets    │       │  │
│  │  │  PostgreSQL  │     │    Manager    │       │  │
│  │  └──────────────┘     └───────────────┘       │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
            ┌────────────────┐
            │   Salesforce   │
            │  Maxis Prod    │
            └────────────────┘
```

---

## Service Ports

| Port | Service | Purpose |
|------|---------|---------|
| 3000 | Dashboard | Main UI (CloudFront in production) |
| 8000 | TMF Server | TMF REST APIs |
| 8080 | CloudSense JS Gateway | Browser automation (optional) |
| 8082 | Batch Orchestrator | Unified remediation API |
| 5432 | PostgreSQL | Database (internal only) |

---

## Key Differences from Legacy Architecture

### ✅ **NEW: Unified Orchestrator Approach**
- **Single API** for manual and scheduled remediation
- **TMF-only access** - no direct Apex Tooling API calls
- **5-step workflow** with ServiceProblem tracking
- **Async processing** with status polling

### ❌ **REMOVED: Legacy 1147-Gateway**
- Direct Apex script execution via Tooling API
- Separate 3-step remediation flow
- Multiple endpoints for different operations

### Benefits of New Architecture:
1. **Simplified** - One remediation endpoint instead of multiple
2. **Consistent** - All operations through TMF API
3. **Traceable** - ServiceProblem lifecycle for audit
4. **Scalable** - Async processing with scheduler

---

## Environment Variables

### Dashboard
```env
NEXT_PUBLIC_TMF_API_URL=http://bssmagic-alb-*.elb.amazonaws.com
TMF_API_KEY=bssmagic-d58d6761265b01accc13e8b21bae8282
BATCH_ORCHESTRATOR_URL=http://localhost:8082
```

### Batch Orchestrator
```env
TMF_BASE_URL=http://bssmagic-alb-*.elb.amazonaws.com
TMF_API_KEY=bssmagic-d58d6761265b01accc13e8b21bae8282
SCHEDULER_ENABLED=true
REMEDIATION_MAX_DURATION=300000
```

---

## Quick Reference Commands

```bash
# Start Dashboard (local)
cd dashboard && npm run dev

# Start Batch Orchestrator (local)
cd batch-orchestrator && python -m app.main

# Deploy to AWS
cd infrastructure && ./scripts/deploy.sh

# Check service health
curl http://bssmagic-alb-*.elb.amazonaws.com/health
curl http://localhost:8082/status

# Trigger manual remediation
curl -X POST http://localhost:8082/remediate/a246D000000pOYsQAM

# View CloudWatch logs
aws logs tail /ecs/bssmagic-runtime --follow
aws logs tail /ecs/batch-orchestrator --follow
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-02-22 | Removed 1147-gateway, unified architecture with Batch Orchestrator |
| 1.0 | 2026-01-20 | Initial architecture with separate gateways |
