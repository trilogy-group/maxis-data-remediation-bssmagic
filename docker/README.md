# BSS Magic Middleware - Docker Deployment

This folder contains Docker configuration for deploying the BSS Magic middleware components.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              COMBINED CONTAINER                              │
│  ┌─────────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  TS Dashboard   │  │ 1147-Gateway│  │   JS Gateway    │  │
│  │    (Next.js)    │  │  (FastAPI)  │  │ (FastAPI+Play)  │  │
│  │    Port 3000    │  │  Port 8081  │  │   Port 8080     │  │
│  └─────────────────┘  └─────────────┘  └─────────────────┘  │
│                                                              │
│                     supervisord                              │
└─────────────────────────────────────────────────────────────┘
```

## Files

| File | Description |
|------|-------------|
| `Dockerfile.combined` | Multi-service Docker image |
| `supervisord.conf` | Process manager config |
| `docker-compose.yml` | Local development setup |
| `build-and-push.sh` | Build & push to AWS ECR |
| `deploy-ecs.sh` | Deploy to AWS ECS |
| `env.example.txt` | Environment variables template |

## Quick Start (Local)

### 1. Setup Environment

```bash
# Copy environment template
cp docker/env.example.txt docker/.env

# Edit with your Salesforce credentials
nano docker/.env
```

### 2. Build & Run Locally

```bash
# Build and start all services
docker-compose -f docker/docker-compose.yml up --build

# Or run in background
docker-compose -f docker/docker-compose.yml up -d --build
```

### 3. Verify Services

```bash
# Check all services are healthy
curl http://localhost:3000/api/health    # TS Dashboard
curl http://localhost:8081/health        # 1147-Gateway
curl http://localhost:8080/health        # JS Gateway (if available)
```

## AWS Deployment

### Prerequisites

1. **AWS CLI** configured with `totogi-runtime` profile
2. **ECR Repository**: `bssmagic-middleware`
3. **Secrets Manager** with Salesforce credentials:
   - `bssmagic/salesforce` containing `username`, `password`, `security_token`
4. **ECS Cluster**: `bssmagic-cluster`
5. **IAM Role**: `ecsTaskExecutionRole` with Secrets Manager access

### Deployment Steps

```bash
# 1. Create symlink for TS Dashboard (if needed)
ln -sf "01K5Z9VSEA0JG8ZVPCSC7CXVYR-5f4a7929-346a-4bfd-bd81-71f982b26563-2025-12-04T13-49-10-460Z (2)" ts-dashboard

# 2. Build and push to ECR
./docker/build-and-push.sh v1.0.0

# 3. Deploy to ECS
./docker/deploy-ecs.sh v1.0.0
```

### ALB Configuration

Configure Application Load Balancer with these target groups:

| Port | Path | Service |
|------|------|---------|
| 3000 | `/` | TypeScript Dashboard |
| 8081 | `/api/1867/*`, `/api/1147/*` | 1147-Gateway |
| 8080 | `/api/oe/*`, `/api/configurations` | JS Gateway |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SF_USERNAME` | Salesforce username | Yes |
| `SF_PASSWORD` | Salesforce password | Yes |
| `SF_SECURITY_TOKEN` | Salesforce security token | Yes |
| `SF_LOGIN_URL` | Salesforce login URL | No (default: test) |
| `NEXT_PUBLIC_TMF_API_URL` | BSS Magic Runtime URL | No |
| `TMF_API_KEY` | BSS Magic API key | No |

## Logs

### Local (Docker Compose)

```bash
# View all logs
docker-compose -f docker/docker-compose.yml logs -f

# View specific service
docker logs bssmagic-middleware
```

### AWS (CloudWatch)

Log group: `/ecs/bssmagic-middleware`

```bash
# Get latest logs
aws logs get-log-events \
    --log-group-name "/ecs/bssmagic-middleware" \
    --log-stream-name "ecs/bssmagic-middleware/[task-id]" \
    --profile totogi-runtime \
    --region ap-southeast-1
```

## Troubleshooting

### Container won't start

1. Check supervisor logs:
   ```bash
   docker exec -it bssmagic-middleware cat /var/log/supervisor/supervisord.log
   ```

2. Check individual service logs:
   ```bash
   docker exec -it bssmagic-middleware cat /var/log/supervisor/ts-dashboard.err.log
   docker exec -it bssmagic-middleware cat /var/log/supervisor/gateway-1147.err.log
   ```

### Salesforce connection issues

1. Verify credentials in `.env`
2. Check security token is current
3. Ensure IP is whitelisted in Salesforce

### Port conflicts

```bash
# Check what's using ports
lsof -i:3000
lsof -i:8080
lsof -i:8081

# Kill processes if needed
kill -9 $(lsof -ti:3000)
```

## Image Size Optimization

Current image size: ~1.5GB

To reduce:
1. Use `node:18-alpine` instead of `node:18-slim`
2. Use multi-stage builds more aggressively
3. Remove Playwright if JS Gateway not needed (~500MB savings)

## Security Notes

1. **Never commit `.env` files** - They contain secrets
2. **Use AWS Secrets Manager** for production credentials
3. **Restrict network access** - Only ALB should access container ports
4. **Enable VPC endpoints** - For ECR, Secrets Manager, CloudWatch
