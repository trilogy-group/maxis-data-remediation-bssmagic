# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BSS Magic Runtime is a telecommunications middleware system that exposes CloudSense (Salesforce) data through TMF-compliant REST APIs. It consists of:

- **BSS Magic Runtime**: PostgreSQL + Foreign Data Wrapper (FDW) + TMF API Server that translates CloudSense objects to TMF standards
- **TypeScript Dashboard**: Next.js application for monitoring services, products, and data quality issues
- **1147-Gateway**: FastAPI service for automated remediation of CloudSense migration issues via Apex scripts
- **CloudSense JS Gateway**: FastAPI + Playwright service for CloudSense browser automation (OE updates)

**Deployment**: AWS ECS Fargate (Singapore region) with Application Load Balancer

## Common Development Commands

### TypeScript Dashboard
```bash
cd ts-dashboard  # Symlink to the actual dashboard directory
npm install
npm run dev              # Development server (port 3000)
npm run build            # Production build
npm run start            # Start production server
npm run test             # Run unit tests (Vitest)
npm run test:e2e         # Run E2E tests (Playwright)
npm run lint             # Biome linting
npm run format           # Auto-format code
```

### 1147-Gateway (Remediation Service)
```bash
cd 1147-gateway
./setup.sh               # Interactive credential setup
pip install -r requirements.txt
python -m app.main       # Start on port 8081
# Swagger docs: http://localhost:8081/docs
```

### CloudSense JS Gateway
```bash
cd cloudsense-js-gateway
pip install -r requirements.txt
python main.py           # Start on port 8080
```

### BSS Magic Runtime (Local Docker)
```bash
# Start runtime with credentials
CREDENTIALS_FILE=./credentials.zip docker compose up

# View logs
docker compose logs -f bssmagic-runtime

# Health checks
curl http://localhost:8000/docs.html        # API docs
curl http://localhost:3000/health           # Controller health
curl http://localhost:8000/metadata         # TMF metadata
```

### Custom Runtime Views (SQL)
```bash
cd custom-runtime
./deploy_to_sandbox.sh   # Deploy all custom types and views to sandbox runtime
```

### Docker Multi-Service Build & Deploy
```bash
cd docker
./build-and-push.sh v1.0.0    # Build and push to AWS ECR
./deploy-ecs.sh v1.0.0        # Deploy to AWS ECS
```

### AWS Infrastructure Management
```bash
cd aws-deployment
./scripts/deploy.sh                          # Deploy full infrastructure (~10 min)
./scripts/setup-secrets.sh                   # Store Salesforce credentials in Secrets Manager
./scripts/upload-credentials-simple.sh ../vlad-runtime-credentials.zip
./scripts/status.sh                          # Check deployment status
./scripts/cleanup.sh                         # Remove all AWS resources
```

### CloudWatch Monitoring
```bash
./scripts/setup-cloudwatch-alarms.sh   # Create CPU, memory, and health alarms
```

## Architecture & Key Concepts

### Component Communication Flow

```
User/Browser → TypeScript Dashboard (3000)
              ↓
              ├→ BSS Magic Runtime (AWS ALB) → PostgreSQL + FDW → Salesforce (SOQL)
              ├→ 1147-Gateway (8081) → Salesforce Tooling API (Apex execution)
              └→ JS Gateway (8080) → Playwright → CloudSense JS APIs
```

### Foreign Data Wrapper (FDW) Pattern

The runtime uses PostgreSQL FDW to translate SQL queries into Salesforce SOQL queries. This means:

- **Direct column references** get pushed to Salesforce (efficient filtering)
- **COALESCE/CASE expressions** do NOT get pushed (client-side filtering, slow)
- **Correlated subqueries** do NOT work well (N+1 query problem)

**Best Practice for Filterable Fields:**
```sql
-- ✅ Good - Direct reference, pushes to SOQL
t0."Status__c"::text AS "status"

-- ❌ Bad - Uses COALESCE, filters client-side
COALESCE(t0."Status__c", 'Unknown')::text AS "status"
```

### TMF View Structure

All TMF views follow this pattern:
```sql
CREATE OR REPLACE VIEW salesforce_server."<tmfEntity>" AS
SELECT
    t0."Id"::text AS "id",
    'http://...' || t0."Id" AS "href",
    -- Field mappings using ROW constructors for complex types
    ROW(...)::tmf."ComplexType" AS "fieldName",
    ARRAY[ROW(...)]::tmf."Type"[] AS "arrayField",
    '<EntityType>'::text AS "@type",
    'Entity'::text AS "@baseType"
FROM salesforce_server."CloudSense_Object__c" t0;
```

### Custom x_* Fields Convention

Custom fields prefixed with `x_` are used for:
- Detection flags (e.g., `x_has1867Issue`, `x_missingPicEmail`)
- Denormalized data for efficient filtering (e.g., `x_serviceType`, `x_parentBundleId`)
- Workarounds for FDW limitations (avoiding client-side filtering)

## Critical Runtime Constraints

### View Redeployment After ECS Restart

**IMPORTANT**: Custom SQL views in `/custom-runtime/views/` are ephemeral and lost on container restart.

After any ECS restart or redeployment:
1. Wait ~3 minutes for container startup
2. Ask user to manually trigger Salesforce foreign table import (via BSS Magic UI or ECS exec)
3. Wait for import completion
4. Run `./apply_all_views.sh` from `/custom-runtime/views/`

See `/docs/AWS_Runtime_View_Redeployment.md` for details.

### Always Ask Before View Changes

**Always ask for user confirmation before modifying, deploying, or applying any SQL view to the AWS runtime.** Views directly affect production TMF API responses.

### CloudWatch Log Access for 500 Errors

When TMF API returns 500 errors, always check CloudWatch logs first:
```bash
export AWS_PROFILE=totogi-runtime AWS_DEFAULT_REGION=ap-southeast-1
LOG_STREAM=$(aws logs describe-log-streams --log-group-name "/ecs/bssmagic-runtime" --order-by LastEventTime --descending --limit 1 --query 'logStreams[0].logStreamName' --output text)
aws logs get-log-events --log-group-name "/ecs/bssmagic-runtime" --log-stream-name "$LOG_STREAM" --limit 50 --query 'events[*].message' --output text
```

Common causes: JSONB parsing errors, FDW timeouts, type casting issues.

## AWS Environment Details

### Production Runtime
- **AWS Profile**: `totogi-runtime`
- **Region**: `ap-southeast-1` (Singapore)
- **ECS Cluster**: `bssmagic-cluster`
- **Service Name**: `bssmagic-service` (production), `bssmagic-runtime-sandbox` (sandbox)
- **ALB URL**: `http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com`
- **API Key Header**: `X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282`
- **Container Tag**: `custom-v1` (NOT `latest`)

### Sandbox vs Production
- **Production**: Default (no header), service name `bssmagic-service`
- **Sandbox**: Use `X-Environment: sandbox` header OR `/sandbox/*` path prefix, service name `bssmagic-runtime-sandbox`

**Always test in Sandbox first before deploying to Production.**

### ECS Container Access
```bash
export AWS_PROFILE=totogi-runtime AWS_DEFAULT_REGION=ap-southeast-1
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-service --query 'taskArns[0]' --output text)
aws ecs execute-command --cluster bssmagic-cluster --task $TASK_ARN --container bssmagic-runtime --interactive --command "/bin/bash"

# Inside container - access PostgreSQL
PGPASSWORD=admin psql -h localhost -U admin -d bssmagic_runtime
```

## Key File Locations

### Documentation
- `/docs/1_BSS_Magic_Runtime_Guide.md` - Complete runtime guide
- `/docs/2_TMF_Entity_Mappings.md` - TMF entity mappings reference
- `/docs/3_CloudSense_JS_Gateway.md` - JS Gateway documentation
- `/docs/4_TypeScript_Dashboard_App.md` - Dashboard documentation
- `/docs/5_AWS_Runtime_Access_Guide.md` - AWS access guide
- `/docs/8_Custom_Schema_Extension_Guide.md` - Custom field guide (x_* fields)
- `/docs/FINAL_1867_Solution.md` - 1867 patching solution details
- `/docs/ARCHITECTURE.md` - System architecture overview

### Configuration
- `/custom-runtime/tmf.sql` - PostgreSQL TMF type definitions (217KB)
- `/custom-runtime/BOOT-INF/classes/types.json` - TMF server type definitions
- `/custom-runtime/views/*.sql` - 48 SQL views mapping CloudSense to TMF
- `/docker/supervisord.conf` - Multi-service process management
- `/aws-deployment/cloudformation/infrastructure.yaml` - Complete AWS infrastructure

### Credentials (Do NOT commit)
- `/1147-gateway/.env` - Salesforce credentials for 1147-Gateway
- `/cloudsense-js-gateway/.env` - Salesforce credentials for JS Gateway
- `vlad-runtime-credentials.zip` - Runtime authentication bundle (x.509 certs)

## Development Workflow Patterns

### Adding a New TMF View
1. Create SQL file in `/custom-runtime/views/<entity>.sql`
2. Use direct column references for filterable fields (avoid COALESCE/CASE)
3. Use ROW constructors for TMF complex types: `ROW(...)::tmf."TypeName"`
4. Test locally against sandbox
5. Ask user before deploying to production
6. Deploy via `./deploy_to_sandbox.sh`

### Troubleshooting TMF API Issues
1. Check CloudWatch logs first (see commands above)
2. Verify FDW connection: `SELECT * FROM salesforce_server."Object__c" LIMIT 1;`
3. Check view definition: `\d+ salesforce_server."tmfEntity"`
4. Test query directly in PostgreSQL before exposing via API
5. Verify type casting matches TMF schema in `/custom-runtime/tmf.sql`

### Deploying Dashboard Changes
```bash
cd ts-dashboard
npm run build            # Build Next.js app
npm run start            # Test production build locally

# Deploy to CloudFront
cd ..
./scripts/deploy-dashboard.sh
```

### Testing 1147-Gateway Remediation
```bash
# Start gateway locally
cd 1147-gateway
python -m app.main

# Test health
curl http://localhost:8081/health

# Test remediation (Swagger UI)
open http://localhost:8081/docs

# Or use curl
curl -X POST http://localhost:8081/api/1147/remediate-full \
  -H "Content-Type: application/json" \
  -d '{"solutionId": "a246D000000pOYsQAM"}'
```

## TMF Standards Reference

The runtime exposes 60+ TMF standard entities across multiple domains:

**Core Entities (Most Used)**:
- TMF638: service (Service Inventory)
- TMF637: product (Product Inventory)
- TMF663: shoppingCart (Shopping Cart)
- TMF622: productOrder (Product Ordering)
- TMF632: individual, organization (Party Management)
- TMF666: billingAccount, partyAccount (Account Management)
- TMF656: serviceProblem (Service Problem Management)

All TMF API endpoints follow pattern: `/tmf-api/<domain>/v5/<entity>`

Example: `/tmf-api/serviceInventoryManagement/v5/service`

## Special Considerations

### CloudSense Gateways Performance
- **1147-Gateway**: Fast (~100ms), uses Salesforce Tooling API
- **JS Gateway**: Slow (30-60s per request), uses Playwright browser automation

### FDW Query Optimization
- FDW pushes WHERE clauses and LIMIT to Salesforce (efficient)
- Use LIMIT liberally to avoid large result sets
- Avoid JOINs across multiple Salesforce objects when possible
- Consider denormalization for frequently accessed data

### Git Workflow
- Never commit AWS credentials
- Never commit Salesforce credentials
- Backup internal PostgreSQL database before redeployment (ephemeral storage!)
- Use `DROP VIEW IF EXISTS` before `CREATE VIEW` when changing column order

### Testing Strategy
- Test SQL views in sandbox runtime first
- Verify TMF API responses match TMF schema
- Check CloudWatch logs for errors during testing
- Use `/metadata` endpoint to verify view registration

## Service Ports Reference

| Port | Service | Purpose |
|------|---------|---------|
| 3000 | TypeScript Dashboard | Main UI |
| 8000 | TMF Server | TMF REST APIs |
| 8080 | CloudSense JS Gateway | Browser automation for OE |
| 8081 | 1147-Gateway | Apex-based remediation |
| 5432 | PostgreSQL | Database (internal only) |

## Additional Notes

- The TypeScript dashboard uses TanStack Query for data fetching - check `src/hooks/` for API integration patterns
- Biome is used for linting/formatting (not ESLint/Prettier)
- Python gateways use FastAPI with automatic OpenAPI docs at `/docs`
- AWS deployment uses CloudFormation for infrastructure-as-code
- ECS services use Fargate with platform version 1.4.0+ for ephemeral storage encryption
- CloudWatch Container Insights is enabled for all ECS services
- Multi-AZ deployment with 2 availability zones for high availability

## Runtime Source Code Reference

**The BSS Magic Runtime source code** lives in a separate private repo that is accessible via `gh` CLI:
- **Repo:** `trilogy-group/totogi-bss-magic-ontology` (branch: `staging`)
- **This is the upstream runtime** - consult it when blocked on runtime behavior, debugging errors, or extending the system

**Key source directories:**
- `runtime/server/src/.../tmfServer/service/` - OperationService (SQL generation for CRUD)
- `runtime/server/src/.../tmfServer/contoller/` - DynamicApiController (HTTP → SQL mapping)
- `runtime/server/src/.../tmfServer/registry/` - Entity discovery from `salesforce_server` schema
- `runtime/fdw/rest/src/fdw_rest/` - REST FDW adapter (Python) - OAuth, write_mapping, etc.
- `runtime/fdw/salesforce/src/fdw_salesforce/` - Salesforce SOQL FDW adapter
- `runtime/controller/` - Startup orchestration, auto-discovery flow
- `runtime/server/src/main/resources/specs/` - Built-in TMF OpenAPI specs

**Access pattern:**
```bash
# Read a file
gh api "repos/trilogy-group/totogi-bss-magic-ontology/contents/<path>" -f ref=staging --jq '.content' | base64 -d

# Search tree
gh api "repos/trilogy-group/totogi-bss-magic-ontology/git/trees/staging?recursive=1" --jq '.tree[] | select(.path | test("<pattern>")) | .path'
```
