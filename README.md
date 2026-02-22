# BSS Magic Runtime

Telecommunications middleware exposing CloudSense (Salesforce) data through TMF-compliant REST APIs.

## What is BSS Magic?

BSS Magic Runtime translates CloudSense business objects into TM Forum (TMF) standard APIs, enabling:
- **Standard Integration**: TMF-compliant REST APIs for telco systems
- **Data Quality**: Automated detection and remediation of migration issues
- **Real-time Access**: PostgreSQL Foreign Data Wrapper (FDW) to Salesforce
- **Batch Processing**: Orchestrated remediation workflows

## System Components

- **Runtime**: PostgreSQL + TMF Server + Salesforce FDW (AWS ECS)
- **Batch Orchestrator**: Unified remediation service for manual and scheduled operations (Python FastAPI)
- **Dashboard**: Next.js monitoring UI (React + TanStack Query)
- **CloudSense JS Gateway**: Browser automation for CloudSense operations (optional)

## Quick Start

### Prerequisites
- Docker & Docker Compose
- AWS CLI (for deployment)
- Node.js 18+ (for dashboard development)
- Python 3.9+ (for gateways)

### Getting Credentials

You need Salesforce credentials to run BSS Magic Runtime:

**Option 1: For New Developers**
1. Request `credentials.zip` from your team lead
2. Place it in the project root
3. Contact admin for Salesforce sandbox access

**Option 2: For AWS Deployment**
See [AWS Runtime Access Guide](docs/5_AWS_Runtime_Access_Guide.md) for:
- How to retrieve credentials from AWS Secrets Manager
- How to create credentials.zip for local development

### Environment Configuration

Before starting services, configure environment variables:

```bash
# Dashboard
cp dashboard/.env.example dashboard/.env.local
# Edit dashboard/.env.local with your TMF API URL and settings

# Batch Orchestrator
cp batch-orchestrator/.env.example batch-orchestrator/.env
# Edit with TMF API URL and orchestrator settings

# CloudSense JS Gateway (optional)
cp gateways/cloudsense-js-gateway/.env.example gateways/cloudsense-js-gateway/.env
# Edit with Salesforce credentials if using browser automation
```

**Environment Variables:**
- `TMF_API_URL`: URL to BSS Magic Runtime (AWS ALB or local)
- `TMF_API_KEY`: API key for TMF server authentication
- `SF_USERNAME`, `SF_PASSWORD`, `SF_SECURITY_TOKEN`: Salesforce credentials
- `SF_LOGIN_URL`: Salesforce instance URL

### Local Development

1. **Start Runtime (Docker)**
   ```bash
   CREDENTIALS_FILE=./credentials.zip docker compose up
   ```

2. **Start Dashboard**
   ```bash
   cd dashboard
   npm install
   npm run dev  # http://localhost:3000
   ```

3. **Start Batch Orchestrator**
   ```bash
   # Batch Orchestrator (autonomous remediation)
   cd batch-orchestrator
   python -m app.main  # http://localhost:8082
   ```

### AWS Deployment

See [Infrastructure Guide](infrastructure/README.md)

```bash
cd infrastructure
./scripts/deploy.sh                     # Deploy full stack (~10 min)
./scripts/setup-secrets.sh              # Store credentials
./scripts/status.sh                     # Check deployment
```

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Runtime Guide](docs/1_Runtime_Guide.md)
- [TMF Entity Mappings](docs/2_TMF_Entity_Mappings.md)
- [CloudSense Gateways](docs/3_CloudSense_Gateways.md)
- [AWS Deployment](docs/4_AWS_Deployment_Guide.md)
- [View Development](docs/5_View_Development_Guide.md)
- [Troubleshooting](docs/6_Troubleshooting.md)

## Key Concepts

### TMF Standards
Exposes 60+ TMF API endpoints across multiple domains:
- TMF637: Product Inventory
- TMF638: Service Inventory
- TMF663: Shopping Cart
- TMF666: Account Management
- TMF656: Service Problem Management

### Foreign Data Wrapper (FDW)
PostgreSQL FDW translates SQL queries into Salesforce SOQL:
- Direct column references push to Salesforce (efficient)
- Complex expressions filter client-side (avoid)
- See [FDW Limitations](docs/18_FDW_Limitations_and_Salesforce_Rate_Limiting.md)

### Custom Views
SQL views in `runtime/views/` map CloudSense objects to TMF entities. Views are ephemeral and must be redeployed after ECS restart.

## Architecture

```
                    ┌─────────────────┐
                    │  User/Browser   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────────┐
                    │  Dashboard (3000)   │
                    └─┬─────────────────┬─┘
                      │                 │
        READ OPS      │                 │      WRITE/REMEDIATION OPS
      (GET queries)   │                 │      (POST /remediate/*)
                      │                 │
                      ▼                 ▼
            /api/tmf-api/*    /api/orchestrator/remediate/*
                      │                 │
                      │                 ▼
                      │     ┌──────────────────────┐
                      │     │ Batch Orchestrator   │
                      │     │      (8082)          │
                      │     └──────────┬───────────┘
                      │                │
                      └────────────────┘
                             │
                    ┌────────▼────────────┐
                    │  TMF Runtime (ALB)  │
                    └────────┬────────────┘
                             │
                    ┌────────▼────────────┐
                    │ PostgreSQL + FDW    │
                    └────────┬────────────┘
                             │
                    ┌────────▼────────────┐
                    │     Salesforce      │
                    └─────────────────────┘

Flow:
- READ Operations: Dashboard → TMF Runtime API directly
- WRITE Operations: Dashboard → Batch Orchestrator → TMF Runtime API
- All TMF Runtime operations use PostgreSQL FDW to access Salesforce
```

## Contributing

### Development Workflow

When adding a new TMF view:
1. Create SQL file in `runtime/views/<entity>.sql`
2. Use direct column references for filterable fields (avoid COALESCE/CASE)
3. Use ROW constructors for TMF complex types: `ROW(...)::tmf."TypeName"`
4. Test locally against sandbox
5. Deploy via `./runtime/views/apply_all_views.sh`

### Code Style
- **TypeScript**: Biome for linting/formatting
- **Python**: Black + isort
- **SQL**: Lowercase keywords, 2-space indentation

## License

Proprietary - Totogi/CloudSense
