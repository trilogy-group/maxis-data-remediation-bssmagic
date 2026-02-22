# BSS Magic TMF Runtime - AWS ECS Setup Guide

Complete guide for deploying the BSS Magic TMF Runtime to AWS ECS (Fargate).

**Document Version:** 1.0  
**Last Updated:** January 28, 2026  
**Estimated Time:** 2-3 hours

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step 1: Transfer Docker Image](#step-1-transfer-docker-image)
4. [Step 2: Set Up EFS for Credentials](#step-2-set-up-efs-for-credentials)
5. [Step 3: Create IAM Roles](#step-3-create-iam-roles)
6. [Step 4: Create Task Definition](#step-4-create-task-definition)
7. [Step 5: Create ALB and Target Group](#step-5-create-alb-and-target-group)
8. [Step 6: Create ECS Service](#step-6-create-ecs-service)
9. [Step 7: Configure Salesforce Credentials](#step-7-configure-salesforce-credentials)
10. [Step 8: Run Table Discovery](#step-8-run-table-discovery)
11. [Troubleshooting](#troubleshooting)
12. [Appendix: Key Learnings](#appendix-key-learnings)

---

## Prerequisites

### AWS Resources Required
- AWS Account with ECS, ECR, EFS, ALB permissions
- VPC with private subnets and NAT Gateway (for internet access)
- Security groups allowing:
  - Inbound: 8000 (TMF API), 3000 (Health)
  - Outbound: 443 (Salesforce, AWS IoT)

### Files Required
- `credentials.zip` from BSS Magic design-time platform
- Salesforce OAuth credentials (client_id, client_secret, username, password, security_token)

### Tools Required
- AWS CLI v2 configured with appropriate profile
- Docker (for local testing only)
- jq (for JSON parsing)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Account                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │     ALB     │───▶│ ECS Fargate │◀──▶│        EFS          │  │
│  │  (Port 8000)│    │   Task      │    │ (credentials.zip)   │  │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│                    ┌───────────────┐                            │
│                    │  NAT Gateway  │                            │
│                    └───────┬───────┘                            │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │   External Services          │
              │  • Salesforce API            │
              │  • AWS IoT (BSS Magic DT)    │
              │  • Totogi ECR (image pull)   │
              └──────────────────────────────┘
```

---

## Step 1: Transfer Docker Image

The BSS Magic runtime image is hosted in Totogi's ECR. You need to transfer it to your account's ECR.

### 1.1 Create ECR Repository

```bash
export AWS_PROFILE=your-profile
export AWS_DEFAULT_REGION=us-east-1

aws ecr create-repository \
  --repository-name bssmagic-tmf-runtime \
  --image-scanning-configuration scanOnPush=true
```

### 1.2 Create CodeBuild Project for Image Transfer

Create `buildspec-image-transfer.yml`:

```yaml
version: 0.2
env:
  variables:
    SOURCE_IMAGE: "008731404932.dkr.ecr.us-east-1.amazonaws.com/prod/bssmagic-runtime:latest"
    DEST_REPO: "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/bssmagic-tmf-runtime"
    DEST_TAG: "latest"
phases:
  pre_build:
    commands:
      - echo "Authenticating with Totogi ECR..."
      - aws s3 cp s3://your-bucket/credentials.zip ./credentials.zip
      - aws s3 cp s3://your-bucket/docker-login.sh ./docker-login.sh
      - chmod +x docker-login.sh
      - source ./docker-login.sh ./credentials.zip
  build:
    commands:
      - echo "Pulling image from Totogi ECR..."
      - docker pull $SOURCE_IMAGE
      - docker tag $SOURCE_IMAGE $DEST_REPO:$DEST_TAG
      # CRITICAL: Unset Totogi credentials before pushing to your ECR
      - unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
      - echo "Authenticating with destination ECR..."
      - aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
      - echo "Pushing image..."
      - docker push $DEST_REPO:$DEST_TAG
```

### 1.3 Run CodeBuild

```bash
aws codebuild start-build --project-name bssmagic-image-transfer
```

---

## Step 2: Set Up EFS for Credentials

The runtime needs `credentials.zip` mounted at `/credentials.zip`.

### 2.1 Create EFS File System

```bash
VPC_ID="vpc-xxxxxxxx"  # Your VPC ID

EFS_ID=$(aws efs create-file-system \
  --performance-mode generalPurpose \
  --throughput-mode bursting \
  --encrypted \
  --tags Key=Name,Value=bssmagic-credentials \
  --query 'FileSystemId' --output text)

echo "EFS ID: $EFS_ID"
```

### 2.2 Create Mount Targets

```bash
# For each private subnet
for SUBNET_ID in subnet-xxx subnet-yyy; do
  aws efs create-mount-target \
    --file-system-id $EFS_ID \
    --subnet-id $SUBNET_ID \
    --security-groups sg-xxxxxxxx
done
```

### 2.3 Upload Credentials to EFS

Option A: Use a temporary EC2 instance:

```bash
# User data script for EC2
#!/bin/bash
yum install -y amazon-efs-utils aws-cli
mkdir -p /mnt/efs
mount -t efs -o tls $EFS_ID:/ /mnt/efs
mkdir -p /mnt/efs/credentials
aws s3 cp s3://your-bucket/credentials.zip /mnt/efs/credentials/credentials.zip
chmod 644 /mnt/efs/credentials/credentials.zip
```

---

## Step 3: Create IAM Roles

### 3.1 Task Execution Role

```bash
# Trust policy
cat > task-execution-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "ecs-tasks.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name bssmagic-task-execution-role \
  --assume-role-policy-document file://task-execution-trust.json

aws iam attach-role-policy \
  --role-name bssmagic-task-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Add CloudWatch Logs permissions
aws iam put-role-policy \
  --role-name bssmagic-task-execution-role \
  --policy-name CloudWatchLogs \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "*"
    }]
  }'
```

### 3.2 Task Role

```bash
aws iam create-role \
  --role-name bssmagic-task-role \
  --assume-role-policy-document file://task-execution-trust.json

# Add EFS access
aws iam put-role-policy \
  --role-name bssmagic-task-role \
  --policy-name EFSAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["elasticfilesystem:ClientMount", "elasticfilesystem:ClientWrite"],
      "Resource": "*"
    }]
  }'
```

---

## Step 4: Create Task Definition

⚠️ **CRITICAL: Do NOT include container health check** - it causes task restarts during discovery.

```json
{
  "family": "bssmagic-tmf-runtime-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "executionRoleArn": "arn:aws:iam::YOUR_ACCOUNT:role/bssmagic-task-execution-role",
  "taskRoleArn": "arn:aws:iam::YOUR_ACCOUNT:role/bssmagic-task-role",
  "volumes": [{
    "name": "credentials-volume",
    "efsVolumeConfiguration": {
      "fileSystemId": "fs-xxxxxxxx",
      "rootDirectory": "/credentials",
      "transitEncryption": "ENABLED"
    }
  }],
  "containerDefinitions": [{
    "name": "bssmagic-tmf-runtime",
    "image": "YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/bssmagic-tmf-runtime:latest",
    "essential": true,
    "entryPoint": ["sh", "-c"],
    "command": ["cp /credentials-mount/credentials.zip /credentials.zip && exec bssmagic-entrypoint.sh"],
    "portMappings": [
      {"containerPort": 8000, "hostPort": 8000, "protocol": "tcp"},
      {"containerPort": 3000, "hostPort": 3000, "protocol": "tcp"}
    ],
    "mountPoints": [{
      "sourceVolume": "credentials-volume",
      "containerPath": "/credentials-mount",
      "readOnly": true
    }],
    "environment": [
      {"name": "POSTGRES_PASSWORD", "value": "admin"},
      {"name": "POSTGRES_DB", "value": "bssmagic_runtime"},
      {"name": "SALESFORCE_API_VERSION", "value": "v63.0"},
      {"name": "SALESFORCE_CLIENT_ID", "value": "YOUR_CLIENT_ID"},
      {"name": "SALESFORCE_CLIENT_SECRET", "value": "YOUR_CLIENT_SECRET"},
      {"name": "SALESFORCE_USERNAME", "value": "your.user@company.com"},
      {"name": "SALESFORCE_PASSWORD", "value": "PASSWORD+SECURITY_TOKEN"},
      {"name": "SALESFORCE_LOGIN_SERVER", "value": "https://login.salesforce.com"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/bssmagic-tmf-runtime",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs",
        "awslogs-create-group": "true"
      }
    }
  }]
}
```

Register the task definition:

```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

---

## Step 5: Create ALB and Target Group

### 5.1 Create Target Group

⚠️ **CRITICAL: Use very lenient health check settings** - discovery can make the server unresponsive.

```bash
TG_ARN=$(aws elbv2 create-target-group \
  --name bssmagic-tmf-runtime-tg \
  --protocol HTTP \
  --port 8000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-protocol HTTP \
  --health-check-path /health \
  --health-check-interval-seconds 120 \
  --health-check-timeout-seconds 60 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 10 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

echo "Target Group ARN: $TG_ARN"
```

### 5.2 Create ALB

```bash
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name bssmagic-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxxxxxxx \
  --scheme internet-facing \
  --type application \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)
```

### 5.3 Create Listener

```bash
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 8000 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN
```

---

## Step 6: Create ECS Service

```bash
aws ecs create-cluster --cluster-name bssmagic-cluster

aws ecs create-service \
  --cluster bssmagic-cluster \
  --service-name bssmagic-tmf-runtime-service \
  --task-definition bssmagic-tmf-runtime-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxxxxxxx],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=bssmagic-tmf-runtime,containerPort=8000"
```

---

## Step 7: Configure Salesforce Credentials

Update the task definition with your Salesforce OAuth credentials:

| Environment Variable | Value |
|---------------------|-------|
| SALESFORCE_CLIENT_ID | Your Connected App Client ID |
| SALESFORCE_CLIENT_SECRET | Your Connected App Client Secret |
| SALESFORCE_USERNAME | Salesforce username |
| SALESFORCE_PASSWORD | Password + Security Token (concatenated) |
| SALESFORCE_LOGIN_SERVER | `https://login.salesforce.com` or `https://test.salesforce.com` |

Test credentials:

```bash
curl -X POST https://login.salesforce.com/services/oauth2/token \
  -d "grant_type=password" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "username=YOUR_USERNAME" \
  -d "password=YOUR_PASSWORD_AND_TOKEN"
```

---

## Step 8: Run Table Discovery

### 8.1 Verify Runtime is Healthy

```bash
ALB_DNS="your-alb-dns.elb.amazonaws.com"

# Check health
curl http://$ALB_DNS:8000/health

# Check metadata (should show salesforce_server with empty resources)
curl http://$ALB_DNS:8000/metadata | jq '.sources'
```

### 8.2 Trigger Discovery from Design-Time

1. Open BSS Magic design-time platform
2. Navigate to your runtime configuration
3. Click "Discover Tables"
4. Wait for discovery to complete (~15-20 minutes for ~1600 tables)

### 8.3 Monitor Discovery Progress

```bash
TASK_ID="your-task-id"

# Watch batch progress
aws logs filter-log-events \
  --log-group-name /ecs/bssmagic-tmf-runtime \
  --log-stream-names "ecs/bssmagic-tmf-runtime/$TASK_ID" \
  --filter-pattern "batch" \
  --query 'events[-5:].message'
```

Discovery phases:
1. **list_tables** - Lists all Salesforce objects (~1660 tables)
2. **import_batch** - Creates foreign tables (42 batches, ~2 min)
3. **sample_data** - Fetches sample data (332 batches, ~15 min)

---

## Troubleshooting

### Task Keeps Restarting

**Symptom:** Task is replaced every few minutes with "unhealthy" status.

**Cause:** Health check failing during heavy discovery processing.

**Solution:**
1. Remove container health check from task definition
2. Increase ALB health check tolerance:
   ```bash
   aws elbv2 modify-target-group \
     --target-group-arn $TG_ARN \
     --health-check-interval-seconds 120 \
     --health-check-timeout-seconds 60 \
     --unhealthy-threshold-count 10
   ```

### IoT Connection Flapping

**Symptom:** Logs show repeated "Connected to AWS IoT Core" / "Disconnected" (reason 142).

**Cause:** MQTT client ID conflict with BSS Magic design-time platform.

**Impact:** Minimal - commands still get through during connected periods.

**Note:** This is a design-time platform limitation, not fixable on runtime side.

### Discovery Fails to Complete

**Symptom:** Discovery progress resets to 0%.

**Cause:** Task was replaced during discovery, losing PostgreSQL data.

**Solution:** Ensure health checks are lenient enough for discovery to complete (~20 min).

### 502 Bad Gateway

**Symptom:** ALB returns 502.

**Cause:** Backend task unhealthy or not responding.

**Solution:** Check task logs, ensure Salesforce credentials are correct.

---

## Appendix: Key Learnings

### Why No Container Health Check?

The BSS Magic runtime runs:
- PostgreSQL (embedded)
- Node.js Controller (port 3000)
- Java TMF Server (port 8000)

During table discovery, the Node.js controller blocks while querying Salesforce for 1660 tables. This makes the `/health` endpoint unresponsive, triggering health check failures.

The production runtime (totogi-runtime account) has **no container health check** - only ALB health check with lenient settings.

### Health Check Settings That Work

| Setting | Value | Why |
|---------|-------|-----|
| Container health check | **None** | Prevents task restarts during discovery |
| ALB interval | 120s | Longer intervals reduce false positives |
| ALB timeout | 60s | Server can be slow during discovery |
| ALB unhealthy threshold | 10 | 20 min tolerance for discovery |

### PostgreSQL is Ephemeral

PostgreSQL runs inside the container. When the task is replaced:
- All discovered tables are lost
- Discovery must run again from scratch

Consider EFS-backed PostgreSQL for persistence (complex setup).

---

## Quick Reference

### Useful Commands

```bash
# Check task status
aws ecs describe-tasks --cluster bssmagic-cluster --tasks $TASK_ARN

# View recent logs
aws logs filter-log-events \
  --log-group-name /ecs/bssmagic-tmf-runtime \
  --log-stream-names "ecs/bssmagic-tmf-runtime/$TASK_ID" \
  --limit 50

# Check discovery progress
aws logs filter-log-events ... --filter-pattern "batch"

# Force new deployment
aws ecs update-service --cluster bssmagic-cluster \
  --service bssmagic-tmf-runtime-service \
  --force-new-deployment

# Check ALB health
curl http://$ALB_DNS:8000/metadata | jq '.sources[0].resources | length'
```

### Ports

| Port | Service | Purpose |
|------|---------|---------|
| 8000 | TMF Server | TMF APIs, Swagger UI |
| 3000 | Controller | Health check, internal |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| SALESFORCE_CLIENT_ID | Yes | OAuth Client ID |
| SALESFORCE_CLIENT_SECRET | Yes | OAuth Client Secret |
| SALESFORCE_USERNAME | Yes | Salesforce username |
| SALESFORCE_PASSWORD | Yes | Password + Security Token |
| SALESFORCE_LOGIN_SERVER | Yes | login.salesforce.com or test.salesforce.com |
| SALESFORCE_API_VERSION | No | Default: v63.0 |
| POSTGRES_PASSWORD | No | Default: admin |
| POSTGRES_DB | No | Default: bssmagic_runtime |
