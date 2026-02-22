# BSS Magic Runtime - Clean Repository Guide

## What's Included

This repository contains **only production-ready code** extracted from the development environment on 2025-02-22.

### Components Extracted

#### 1. **Runtime** (`runtime/`)
- **49 SQL views** mapping CloudSense to TMF standards
- TMF type definitions (PostgreSQL + JSON)
- Salesforce FDW configuration (3 Python files)
- Deployment scripts for sandbox and production

#### 2. **Batch Orchestrator** (`batch-orchestrator/`)
- FastAPI autonomous remediation service
- 41 Python files (services, models, tests)
- Schedule-based OE execution
- TMF API client integration

#### 3. **Gateways** (`gateways/`)
- **1147-Gateway**: Apex-based solution remediation (70 files)
  - FastAPI service with 29+ endpoints
  - Apex script executor
  - Solution attachment patching
- **CloudSense JS Gateway**: Playwright browser automation
  - OE attribute patching via CloudSense UI

#### 4. **Dashboard** (`dashboard/`)
- Next.js 15 monitoring UI
- 719 TypeScript/TSX files
- React + TanStack Query + Tailwind CSS
- Real-time monitoring, remediation controls, SOQL query builder

#### 5. **Infrastructure** (`infrastructure/`)
- AWS CloudFormation templates
- ECS deployment scripts (deploy, status, cleanup)
- CloudFront configuration
- Task definitions for runtime, orchestrator, sandbox

#### 6. **Docker** (`docker/`)
- Multi-service container configuration
- Supervisord process management
- Build and deployment scripts for ECR

#### 7. **Apex Scripts** (`apex/`)
- 5 Salesforce Apex scripts for remediation
- 1867 patching logic
- CloudSense DB verification

#### 8. **Documentation** (`docs/`)
- 11 essential guides (architecture, deployment, troubleshooting)
- TMF entity mappings reference
- FDW limitations and performance guides

---

## What Was Excluded

✅ **Not included (by design)**:
- Demo materials (demoprep/, screenshots/)
- Meeting transcripts and weekly reports
- Workspace artifacts (Cursor exports)
- Research/analysis documents
- Backup files and temporary artifacts
- Obsolete experimental code (1847 module)
- Virtual environments and node_modules
- Credentials and sensitive files

---

## Repository Statistics

| Metric | Count |
|--------|-------|
| Total files | 892 |
| Total lines of code | 77,024 |
| SQL views | 49 |
| Python files | 45 |
| TypeScript/TSX files | 719 |
| Documentation files | 11 |
| Repository size | 6.1 MB |

---

## Quick Start

### 1. Clone & Setup
```bash
cd ~/bss-magic-runtime-clean
git remote add origin <your-git-repo-url>
git push -u origin main
```

### 2. Local Development
```bash
# Dashboard
cd dashboard && npm install && npm run dev

# 1147 Gateway
cd gateways/1147-gateway && ./setup.sh && python -m app.main

# Batch Orchestrator
cd batch-orchestrator && python -m app.main
```

### 3. AWS Deployment
```bash
cd infrastructure
./scripts/deploy.sh
./scripts/setup-secrets.sh
./scripts/status.sh
```

---

## Next Steps

1. **Push to Git**:
   ```bash
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Create Development Branch**:
   ```bash
   git checkout -b develop
   git push -u origin develop
   ```

3. **Tag Release**:
   ```bash
   git tag -a v1.0.0 -m "Initial production release"
   git push origin v1.0.0
   ```

4. **Review Documentation**:
   - Read [README.md](README.md) for project overview
   - Check [ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design
   - Review [deployment guide](docs/4_AWS_Deployment_Guide.md)

5. **Test Locally**:
   - Start dashboard and verify it connects
   - Test 1147-Gateway endpoints
   - Run SQL view deployment scripts

---

## File Structure

```
bss-magic-runtime-clean/
├── README.md                    # Project overview & quick start
├── CLAUDE.md                    # AI assistant instructions
├── .gitignore                   # Git ignore patterns
├── docker-compose.yml           # Local Docker setup
│
├── runtime/                     # PostgreSQL + FDW + TMF views
│   ├── views/                   # 49 SQL views
│   ├── types/                   # TMF type definitions
│   ├── fdw/                     # Foreign Data Wrapper configs
│   └── tests/                   # API tests
│
├── batch-orchestrator/          # Autonomous remediation service
│   ├── app/                     # FastAPI application
│   └── tests/                   # Unit & integration tests
│
├── gateways/                    # Remediation gateways
│   ├── 1147-gateway/            # Apex-based remediation
│   └── cloudsense-js-gateway/   # Browser automation
│
├── dashboard/                   # Next.js monitoring UI
│   ├── src/                     # React components & API routes
│   └── public/                  # Static assets
│
├── infrastructure/              # AWS deployment
│   ├── cloudformation/          # IaC templates
│   ├── scripts/                 # Deployment automation
│   └── task-definitions/        # ECS task configs
│
├── docker/                      # Containerization
│   ├── Dockerfile.combined      # Multi-service image
│   └── supervisord.conf         # Process management
│
├── apex/                        # Salesforce Apex scripts
├── scripts/                     # Utility scripts
└── docs/                        # Documentation (11 guides)
```

---

## Key Contacts & Resources

- **AWS Environment**: Singapore (ap-southeast-1)
- **ECS Cluster**: bssmagic-cluster
- **ALB URL**: http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com
- **Dashboard Port**: 3000
- **1147-Gateway Port**: 8081
- **Batch Orchestrator Port**: 8082

---

## Contributing

See [README.md](README.md) for development guidelines.

Key principles:
- Test in sandbox before production
- Use direct SQL column references (avoid COALESCE in views)
- Follow Biome style for TypeScript
- Use Black + isort for Python
- Document all architectural decisions

---

## License

Proprietary - Totogi/CloudSense

---

**Generated**: 2025-02-22
**Source**: BSS Magic Runtime development environment
**Commit**: 0dbc560
