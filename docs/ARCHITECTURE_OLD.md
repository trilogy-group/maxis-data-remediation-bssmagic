# BSS Magic Runtime - Architecture Document

**Version:** 1.0  
**Last Updated:** January 20, 2026  
**Author:** Vlad Sorici

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Components](#components)
4. [Data Flow](#data-flow)
5. [API Endpoints](#api-endpoints)
6. [Current Deployment](#current-deployment)
7. [Next Steps for AWS Deployment](#next-steps-for-aws-deployment)

---

## System Overview

The BSS Magic Runtime is a middleware solution that enables **TMF Open API** exposure for **CloudSense/Salesforce** data, along with automated remediation tools for data synchronization issues (1147 Solution Empty, 1867 Partial Data Missing).

### Key Capabilities

- **TMF API Exposure**: Exposes CloudSense/Salesforce objects as TMF-compliant REST APIs
- **Data Remediation**: Automated tools for fixing migration issues
- **Real-time Dashboards**: React-based UI for monitoring and operations
- **OE Data Management**: Direct access to CloudSense internal database via Apex APIs

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              USER / BROWSER                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         TYPESCRIPT DASHBOARD APP                                 │
│                              (Port 3000)                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Next.js 14 + React + TanStack Query                                     │   │
│  │  • Service List (1867 Detection)                                         │   │
│  │  • Product/Solution List (1147 Detection)                                │   │
│  │  • ServiceProblem Tracking                                               │   │
│  │  • PIC Email Lookup (via BillingAccount → Individual)                    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                     │                                           │
│  ┌──────────────────────────────────┼──────────────────────────────────────┐   │
│  │              API ROUTES          │                                       │   │
│  │  /api/tmf-api/[...slug]    ──────┼──► Proxy to AWS Runtime               │   │
│  │  /api/service-problem      ──────┼──► TMF656 + 1147-Gateway              │   │
│  └──────────────────────────────────┼──────────────────────────────────────┘   │
└─────────────────────────────────────┼───────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────────────┐
│   1147-GATEWAY      │   │   CLOUDSENSE JS     │   │   BSS MAGIC RUNTIME (AWS)  │
│    (Port 8081)      │   │    GATEWAY          │   │   (ALB: Port 80/443)       │
│                     │   │   (Port 8080)       │   │                             │
│  ┌───────────────┐  │   │  ┌───────────────┐  │   │  ┌───────────────────────┐ │
│  │ FastAPI       │  │   │  │ FastAPI       │  │   │  │ TMF Server (Java)     │ │
│  │ + Apex        │  │   │  │ + Playwright  │  │   │  │                       │ │
│  │   Executor    │  │   │  │   Automation  │  │   │  │ PostgreSQL + FDW      │ │
│  └───────────────┘  │   │  └───────────────┘  │   │  │ → Salesforce          │ │
│                     │   │                     │   │  └───────────────────────┘ │
│  Services:          │   │  Services:          │   │                             │
│  • OE Patching      │   │  • Load Basket      │   │  TMF APIs Exposed:          │
│  • 1147 Remediation │   │  • Get OE Data      │   │  • /product (TMF637)        │
│  • OE Verification  │   │  • Update OE        │   │  • /service (TMF638)        │
│  • Attachment Mgmt  │   │  • Verify OE        │   │  • /shoppingCart (TMF663)   │
│                     │   │                     │   │  • /billingAccount (TMF666) │
└─────────────────────┘   └─────────────────────┘   │  • /individual (TMF632)     │
          │                         │               │  • /organization (TMF632)   │
          │                         │               │  • /serviceProblem (TMF656) │
          │                         │               │  • /productOrder (TMF622)   │
          ▼                         ▼               └─────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         SALESFORCE (CloudSense)                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                           MAXIS FDRV2 SANDBOX                              │ │
│  │                                                                            │ │
│  │  Objects:                          APIs:                                   │ │
│  │  • csord__Solution__c              • Tooling API (Apex Execution)         │ │
│  │  • csord__Service__c               • REST API (SOQL Queries)              │ │
│  │  • cscfga__Product_Basket__c       • Attachment API                       │ │
│  │  • cscfga__Product_Configuration__c                                       │ │
│  │  • csconta__Billing_Account__c     CloudSense OE APIs:                    │ │
│  │  • Contact                         • cssmgnt.API_1.getOEData()            │ │
│  │  • Attachment                      • cssmgnt.API_1.updateOEData()         │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                       │                                         │
│  ┌───────────────────────────────────┴───────────────────────────────────────┐ │
│  │                    CLOUDSENSE HEROKU (Internal DB)                         │ │
│  │                    Order Enrichment / Configuration Data                   │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. TypeScript Dashboard App

| Property | Value |
|----------|-------|
| **Port** | 3000 |
| **Technology** | Next.js 14, React 18, TanStack Query, Tailwind CSS |
| **Location** | `dashboard/` |
| **Deployment** | Local (Development) / AWS CloudFront (Production) |

**Responsibilities:**
- User interface for service/product monitoring
- 1867 issue detection and patching UI
- 1147 issue detection and remediation UI
- PIC Email lookup via multi-API calls
- ServiceProblem tracking dashboard

**Key Files:**
- `src/hooks/useCloudSense.ts` - CloudSense integration hooks
- `src/hooks/useTMF*.ts` - TMF API query hooks
- `src/app/api/tmf-api/[...slug]/route.ts` - TMF API proxy
- `src/components/modules/` - UI modules

---

### 2. 1147-Gateway (OE Patcher)

| Property | Value |
|----------|-------|
| **Port** | 8081 |
| **Technology** | Python 3.9, FastAPI, simple-salesforce |
| **Location** | `1147-gateway/` |
| **Deployment** | Local (Development) |

**Responsibilities:**
- Execute Apex scripts via Salesforce Tooling API
- Patch OE data (CloudSense internal DB + Attachments)
- Verify OE data in CloudSense internal database
- Handle 1147 "Solution Empty" remediation

**Key Services:**
| Service | File | Purpose |
|---------|------|---------|
| Apex Executor | `apex_executor.py` | Execute anonymous Apex |
| OE Patcher | `oe_patcher.py` | Auto-patch missing OE fields |
| Attachment Service | `attachment_service.py` | Fetch/update attachments |
| Compact Patcher | `apex_compact_patcher.py` | Update DB + Attachment |
| OE Verification | `oe_verification_service.py` | Verify CloudSense OE DB |

**API Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/1867/patch-complete` | POST | Patch OE (DB + Attachment) |
| `/api/1867/service/{id}/attachment` | GET | Get attachment content |
| `/api/1867/service/{id}/verify-oe` | GET | Verify OE in CloudSense DB |
| `/api/1867/service/{id}/patch-preview` | GET | Preview patchable fields |
| `/api/1147/remediate` | POST | Execute 1147 remediation |

---

### 3. CloudSense JS Gateway

| Property | Value |
|----------|-------|
| **Port** | 8080 |
| **Technology** | Python 3.9, FastAPI, Playwright |
| **Location** | `cloudsense-js-gateway/` (if exists) |
| **Deployment** | Local (Development) |

**Responsibilities:**
- Browser automation for CloudSense Solution Console
- Load baskets and get configurations
- Update OE attributes via JS API
- Verify OE data via browser context

**Note:** Uses Playwright to execute CloudSense JS APIs (`CS.SM`) in browser context, enabling access to CloudSense internal functionality not available via REST.

---

### 4. BSS Magic Runtime (AWS)

| Property | Value |
|----------|-------|
| **URL** | `http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com` |
| **API Key** | `X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282` |
| **Technology** | Java TMF Server, PostgreSQL, Salesforce FDW |
| **Deployment** | AWS ECS (Fargate) |

**Infrastructure:**
| Component | AWS Service | Details |
|-----------|-------------|---------|
| Container | ECS Fargate | Cluster: `bssmagic-cluster`, Service: `bssmagic-service` |
| Load Balancer | ALB | Public endpoint |
| Container Registry | ECR | Image tag: `custom-v1` |
| Region | ap-southeast-1 | Singapore |
| Account | 652413721990 | Totogi Runtime |

**TMF APIs Exposed:**

| API | Endpoint | CloudSense Object | View File |
|-----|----------|-------------------|-----------|
| TMF637 Product | `/tmf-api/productInventory/v5/product` | csord__Solution__c | `product.sql` |
| TMF638 Service | `/tmf-api/serviceInventoryManagement/v5/service` | csord__Service__c | `service.sql` |
| TMF663 ShoppingCart | `/tmf-api/shoppingCart/v5/shoppingCart` | cscfga__Product_Basket__c | `shoppingCart.sql` |
| TMF666 BillingAccount | `/tmf-api/accountManagement/v5/billingAccount` | csconta__Billing_Account__c | `billingAccount.sql` |
| TMF632 Individual | `/tmf-api/partyManagement/v5/individual` | Contact | `individual.sql` |
| TMF632 Organization | `/tmf-api/partyManagement/v5/organization` | Account | `organization.sql` |
| TMF656 ServiceProblem | `/tmf-api/serviceProblemManagement/v5/serviceProblem` | Internal table | `serviceProblem.sql` |
| TMF622 ProductOrder | `/tmf-api/productOrderingManagement/v5/productOrder` | csord__Order__c | `productOrder.sql` |

**Custom Views Location:** `/custom-runtime/views/`

---

## Data Flow

### 1867 Patching Flow

```
┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌────────────┐
│   UI    │───▶│  TS App     │───▶│ 1147-Gateway│───▶│ Salesforce │
│ (Patch) │    │ (Port 3000) │    │ (Port 8081) │    │  (Apex)    │
└─────────┘    └─────────────┘    └─────────────┘    └────────────┘
                                         │                  │
                                         ▼                  ▼
                                  ┌─────────────┐    ┌────────────┐
                                  │ Verify OE   │    │ CloudSense │
                                  │ (cssmgnt)   │    │ Heroku DB  │
                                  └─────────────┘    └────────────┘
```

### TMF API Query Flow

```
┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌────────────┐
│   UI    │───▶│  TS App     │───▶│ AWS Runtime │───▶│ PostgreSQL │
│ (Query) │    │ /api/tmf-api│    │ TMF Server  │    │    FDW     │
└─────────┘    └─────────────┘    └─────────────┘    └────────────┘
                                                            │
                                                            ▼
                                                     ┌────────────┐
                                                     │ Salesforce │
                                                     │   (SOQL)   │
                                                     └────────────┘
```

---

## API Endpoints

### TypeScript App (Port 3000)

| Endpoint | Method | Target |
|----------|--------|--------|
| `/api/tmf-api/*` | ALL | Proxy to AWS Runtime |
| `/api/service-problem` | POST | Create ServiceProblem + Remediation |

### 1147-Gateway (Port 8081)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/1867/patch-complete` | POST | Full OE patch (DB + Attachment) |
| `/api/1867/service/{id}/attachment` | GET | Fetch attachment JSON |
| `/api/1867/service/{id}/verify-oe` | GET | Verify OE in CloudSense DB |
| `/api/1867/service/{id}/patch-preview` | GET | Preview patchable fields |
| `/api/1147/remediate` | POST | 1147 remediation Apex |
| `/api/1147/remediate-bulk` | POST | Bulk remediation |
| `/health` | GET | Health check |

### CloudSense JS Gateway (Port 8080)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/configurations` | POST | Get basket configurations |
| `/api/oe/update` | POST | Update OE attributes |
| `/api/verify-oe` | POST | Verify OE via browser |
| `/health` | GET | Health check |

### AWS Runtime (ALB)

All TMF APIs follow pattern: `/tmf-api/{domain}/v5/{entity}`

Requires header: `X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282`

---

## Current Deployment

### Local Development

| Component | Status | Port |
|-----------|--------|------|
| TypeScript Dashboard | ✅ Running | 3000 |
| 1147-Gateway | ✅ Running | 8081 |
| CloudSense JS Gateway | ⚠️ Optional | 8080 |

### AWS Production (DEPLOYED)

**Middleware Service (bssmagic-middleware)**
- **Status:** ✅ Running
- **Image:** `652413721990.dkr.ecr.ap-southeast-1.amazonaws.com/bssmagic-middleware:v1`
- **ECS Service:** `bssmagic-middleware` on cluster `bssmagic-cluster`
- **Endpoints via ALB:**
  - `/dashboard*` → TypeScript Dashboard (port 3000) ✅
  - `/api/1867/*` → 1147-Gateway (port 8081) ✅

**Test the deployed services:**
```bash
# Dashboard
curl http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/dashboard

# 1147-Gateway API
curl http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/api/1867/service/a236D000000eq0dQAA/attachment
```

### AWS Production (Original Runtime)

| Component | Status | Location |
|-----------|--------|----------|
| BSS Magic Runtime | ✅ Running | ECS Fargate |
| PostgreSQL | ✅ Running | In-container |
| TMF Server | ✅ Running | In-container |
| Custom SQL Views | ✅ Deployed | 11 views |

### Salesforce

| Component | Status |
|-----------|--------|
| Maxis FDRV2 Sandbox | ✅ Connected |
| FDW OAuth | ✅ Active |
| Apex APIs | ✅ Accessible |

---

## Next Steps for AWS Deployment

### Phase 1: Containerize Middleware Components ✅ READY

**Status:** Docker configuration created in `/docker/` folder

| Task | Priority | Status |
|------|----------|--------|
| 1. Combined Dockerfile | High | ✅ Created |
| 2. Supervisord config | High | ✅ Created |
| 3. docker-compose for local | Medium | ✅ Created |
| 4. Build & push scripts | High | ✅ Created |
| 5. ECS deploy script | High | ✅ Created |

**Files Created:**
- `docker/Dockerfile.combined` - Combined image (TS + Python gateways)
- `docker/supervisord.conf` - Process manager for 3 services
- `docker/docker-compose.yml` - Local development
- `docker/build-and-push.sh` - Build & push to ECR
- `docker/deploy-ecs.sh` - Deploy to ECS
- `docker/README.md` - Full documentation

**Quick Start:**
```bash
# 1. Navigate to project root
cd bss-magic-runtime-clean

# 2. Build and run locally
docker-compose -f docker/docker-compose.yml up --build

# 3. Deploy to AWS
./docker/build-and-push.sh v1.0.0
./docker/deploy-ecs.sh v1.0.0
```

### Phase 2: AWS Infrastructure Setup

| Task | Priority | AWS Service |
|------|----------|-------------|
| 1. Create ECR repositories | High | ECR |
| 2. Set up ECS Task Definitions | High | ECS |
| 3. Configure ALB routing | High | ALB |
| 4. Set up VPC/Security Groups | High | VPC |
| 5. Configure Secrets Manager | High | Secrets Manager |
| 6. Set up CloudWatch logging | Medium | CloudWatch |

**Proposed Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS VPC                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      PUBLIC SUBNET                         │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              Application Load Balancer               │  │  │
│  │  │  • /                → TS Dashboard (3000)            │  │  │
│  │  │  • /api/1867/*      → 1147-Gateway (8081)            │  │  │
│  │  │  • /tmf-api/*       → BSS Magic Runtime (80)         │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     PRIVATE SUBNET                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐│  │
│  │  │ ECS Service │  │ ECS Service │  │    ECS Service      ││  │
│  │  │ TS Dashboard│  │1147-Gateway │  │  BSS Magic Runtime  ││  │
│  │  │   (3000)    │  │   (8081)    │  │  (TMF Server + PG)  ││  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘│  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    SECRETS MANAGER                         │  │
│  │  • SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN             │  │
│  │  • API_KEY                                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   SALESFORCE    │
                    │  (CloudSense)   │
                    └─────────────────┘
```

### Phase 3: CI/CD Pipeline

| Task | Priority | Tool |
|------|----------|------|
| 1. Set up GitHub Actions | High | GitHub Actions |
| 2. Automated testing | Medium | Jest, pytest |
| 3. Docker image build & push | High | GitHub Actions |
| 4. ECS deployment automation | High | AWS CLI / Terraform |
| 5. View deployment automation | Medium | Shell script |

**GitHub Actions Workflow (example):**
```yaml
name: Deploy to AWS
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build & Push Docker Images
        run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
          docker build -t $ECR_REGISTRY/ts-dashboard:${{ github.sha }} ./ts-app
          docker push $ECR_REGISTRY/ts-dashboard:${{ github.sha }}
      - name: Update ECS Service
        run: |
          aws ecs update-service --cluster bssmagic-cluster --service ts-dashboard --force-new-deployment
```

### Phase 4: Production Readiness

| Task | Priority | Notes |
|------|----------|-------|
| 1. SSL/TLS certificates | High | ACM + ALB |
| 2. Custom domain setup | Medium | Route53 |
| 3. Monitoring & Alerts | High | CloudWatch Alarms |
| 4. Auto-scaling configuration | Medium | ECS Auto Scaling |
| 5. Backup strategy | High | RDS for PostgreSQL |
| 6. Disaster recovery plan | Medium | Multi-AZ |

### Phase 5: Security Hardening

| Task | Priority |
|------|----------|
| 1. API Gateway for rate limiting | High |
| 2. WAF rules | Medium |
| 3. VPC endpoints for AWS services | Medium |
| 4. IAM roles refinement | High |
| 5. Secrets rotation | Medium |
| 6. Network ACLs | Medium |

---

## Appendix: Quick Reference

### Ports Summary

| Port | Service | Status |
|------|---------|--------|
| 3000 | TypeScript Dashboard | Local |
| 8080 | CloudSense JS Gateway | Local (Optional) |
| 8081 | 1147-Gateway | Local |
| 80/443 | BSS Magic Runtime | AWS ALB |

### Environment Variables

**1147-Gateway:**
```env
SF_USERNAME=vinay.jagwani@trilogy.com.fdrv2
SF_PASSWORD=***
SF_SECURITY_TOKEN=***
SF_LOGIN_URL=https://maxis--fdrv2.sandbox.my.salesforce.com
```

**TypeScript App:**
```env
NEXT_PUBLIC_TMF_API_URL=http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com
TMF_API_KEY=bssmagic-d58d6761265b01accc13e8b21bae8282
```

### Key Commands

```bash
# Start 1147-Gateway
cd 1147-gateway && source venv/bin/activate && uvicorn app.main:app --port 8081 --reload

# Start TypeScript App
cd ts-app && npm run dev

# Deploy Views to AWS Runtime
cd custom-runtime/views && ./apply_all_views.sh

# Access ECS Container
export AWS_PROFILE=totogi-runtime AWS_DEFAULT_REGION=ap-southeast-1
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-service --query 'taskArns[0]' --output text)
aws ecs execute-command --cluster bssmagic-cluster --task $TASK_ARN --container bssmagic-runtime --interactive --command "/bin/bash"
```

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-20 | Vlad Sorici | Initial architecture document |
