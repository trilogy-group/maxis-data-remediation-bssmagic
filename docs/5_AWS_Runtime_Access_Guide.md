# AWS Runtime Access Guide

**Last Updated**: December 16, 2025  
**Environment**: BSS Magic Runtime on AWS ECS

---

## Overview

This guide provides complete instructions for accessing the BSS Magic Runtime deployed on AWS ECS, including direct database access for SQL execution.

---

## AWS Environment Details

| Property | Value |
|----------|-------|
| **AWS Account ID** | 652413721990 |
| **Region** | ap-southeast-1 (Singapore) |
| **ECS Cluster** | bssmagic-cluster |
| **ECS Service** | bssmagic-service |
| **Container Name** | bssmagic-runtime |
| **Load Balancer** | bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com |

---

## AWS Credentials

### Profile Configuration

```bash
# Configure AWS CLI profile
aws configure --profile totogi-runtime

# When prompted:
# AWS Access Key ID: AKIAZPZXDLWDKEUEKBHZ
# AWS Secret Access Key: [your-secret-key]
# Default region name: ap-southeast-1
# Default output format: json
```

### Verify Configuration

```bash
aws sts get-caller-identity --profile totogi-runtime --region ap-southeast-1
```

---

## TMF API Access

### Base URL

```
http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com
```

### API Endpoints

| API | Path | TMF Standard |
|-----|------|--------------|
| Service | `/tmf-api/serviceInventoryManagement/v5/service` | TMF638 |
| Individual | `/tmf-api/partyManagement/v5/individual` | TMF632 |
| Organization | `/tmf-api/partyManagement/v5/organization` | TMF632 |
| ProductOrder | `/tmf-api/productOrderingManagement/v5/productOrder` | TMF622 |
| PartyAccount | `/tmf-api/accountManagement/v5/partyAccount` | TMF666 |
| BillingAccount | `/tmf-api/accountManagement/v5/billingAccount` | TMF666 |
| Product | `/tmf-api/productInventoryManagement/v5/product` | TMF637 |
| Mappings | `/mappings` | BSS Magic |

### Example API Calls

```bash
# List services
curl "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/service?limit=5"

# Get product orders
curl "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productOrderingManagement/v5/productOrder?limit=5"

# Check all mappings
curl "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/mappings"
```

---

## Direct Container Access (ECS Exec)

### Prerequisites

1. **AWS Session Manager Plugin**
   ```bash
   # macOS
   brew install session-manager-plugin
   
   # Or download from AWS
   # https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html
   ```

2. **AWS CLI v2**
   ```bash
   aws --version  # Should be 2.x.x
   ```

### Get Running Task ID

```bash
# List tasks in cluster
aws ecs list-tasks \
  --cluster bssmagic-cluster \
  --service-name bssmagic-service \
  --profile totogi-runtime \
  --region ap-southeast-1

# Get task ARN (looks like: arn:aws:ecs:ap-southeast-1:652413721990:task/bssmagic-cluster/abc123...)
```

### Connect to Container Shell

```bash
# Replace TASK_ID with actual task ID from above
aws ecs execute-command \
  --cluster bssmagic-cluster \
  --task TASK_ID \
  --container bssmagic-runtime \
  --interactive \
  --command "/bin/bash" \
  --profile totogi-runtime \
  --region ap-southeast-1
```

### One-Liner to Connect

```bash
# Get task and connect in one command
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-service --profile totogi-runtime --region ap-southeast-1 --query 'taskArns[0]' --output text)

aws ecs execute-command \
  --cluster bssmagic-cluster \
  --task $TASK_ARN \
  --container bssmagic-runtime \
  --interactive \
  --command "/bin/bash" \
  --profile totogi-runtime \
  --region ap-southeast-1
```

---

## Database Access

### Inside Container

Once connected via ECS Exec:

```bash
# Connect to PostgreSQL
PGPASSWORD=admin psql -h localhost -U admin -d bssmagic_runtime

# Or use psql directly
psql -U admin
```

### PostgreSQL Commands

```sql
-- List all schemas
\dn

-- List tables in salesforce_server schema
\dt salesforce_server.*

-- List views in salesforce_server schema
\dv salesforce_server.*

-- Check TMF types
\dT tmf.*

-- Query services
SELECT * FROM salesforce_server."csord__Service__c" LIMIT 5;

-- Query orders
SELECT * FROM salesforce_server."csord__Order__c" LIMIT 5;

-- Check view definition
\d+ salesforce_server."productOrder"
```

---

## Executing SQL Remotely

### Method 1: Via ECS Exec with Base64

```bash
# Create SQL
SQL='SELECT COUNT(*) FROM salesforce_server."csord__Order__c";'

# Encode and execute
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-service --profile totogi-runtime --region ap-southeast-1 --query 'taskArns[0]' --output text)

aws ecs execute-command \
  --cluster bssmagic-cluster \
  --task $TASK_ARN \
  --container bssmagic-runtime \
  --interactive \
  --command "bash -c \"echo '$SQL' | PGPASSWORD=admin psql -h localhost -U admin -d bssmagic_runtime\"" \
  --profile totogi-runtime \
  --region ap-southeast-1
```

### Method 2: Via ECS Exec Non-Interactive

```bash
# For complex SQL, use base64 encoding
SQL_BASE64=$(echo 'SELECT * FROM salesforce_server."csord__Order__c" LIMIT 5;' | base64)

aws ecs execute-command \
  --cluster bssmagic-cluster \
  --task $TASK_ARN \
  --container bssmagic-runtime \
  --command "bash -c \"echo $SQL_BASE64 | base64 -d | PGPASSWORD=admin psql -h localhost -U admin -d bssmagic_runtime\"" \
  --profile totogi-runtime \
  --region ap-southeast-1
```

---

## Creating/Updating Views

### Create a New TMF View

```bash
# Connect to container
aws ecs execute-command \
  --cluster bssmagic-cluster \
  --task $TASK_ARN \
  --container bssmagic-runtime \
  --interactive \
  --command "/bin/bash" \
  --profile totogi-runtime \
  --region ap-southeast-1

# Inside container, connect to psql
PGPASSWORD=admin psql -h localhost -U admin -d bssmagic_runtime

# Create view
CREATE VIEW salesforce_server."myEntity" AS
SELECT
    t0."Id"::text AS "id",
    -- ... your mapping
FROM salesforce_server."Source_Object__c" t0;

# Verify
\dv salesforce_server.myEntity
SELECT * FROM salesforce_server."myEntity" LIMIT 1;

# Exit
\q
exit
```

### Update Existing View

```sql
-- Drop and recreate (required if column order changes)
DROP VIEW IF EXISTS salesforce_server."productOrder";

CREATE VIEW salesforce_server."productOrder" AS
-- ... new definition
```

---

## ECS Service Management

### Check Service Status

```bash
aws ecs describe-services \
  --cluster bssmagic-cluster \
  --services bssmagic-service \
  --profile totogi-runtime \
  --region ap-southeast-1
```

### Force Service Restart

```bash
aws ecs update-service \
  --cluster bssmagic-cluster \
  --service bssmagic-service \
  --force-new-deployment \
  --profile totogi-runtime \
  --region ap-southeast-1
```

### View Service Logs

```bash
# Get log group name from task definition
aws ecs describe-task-definition \
  --task-definition bssmagic-runtime \
  --profile totogi-runtime \
  --region ap-southeast-1 \
  --query 'taskDefinition.containerDefinitions[0].logConfiguration.options'

# View logs via CloudWatch
aws logs tail /ecs/bssmagic-runtime \
  --follow \
  --profile totogi-runtime \
  --region ap-southeast-1
```

---

## Troubleshooting

### Cannot Connect via ECS Exec

1. **Check Session Manager Plugin**
   ```bash
   session-manager-plugin --version
   ```

2. **Verify Task is Running**
   ```bash
   aws ecs list-tasks --cluster bssmagic-cluster --profile totogi-runtime --region ap-southeast-1
   ```

3. **Check ECS Exec Enabled**
   ```bash
   aws ecs describe-tasks \
     --cluster bssmagic-cluster \
     --tasks $TASK_ARN \
     --profile totogi-runtime \
     --region ap-southeast-1 \
     --query 'tasks[0].enableExecuteCommand'
   ```

### Database Connection Issues

1. **Verify Database Running**
   ```bash
   # Inside container
   pg_isready -h localhost -U admin
   ```

2. **Check Database Name**
   ```bash
   psql -U admin -l  # List databases
   ```

### API Not Responding

1. **Check Load Balancer Health**
   ```bash
   aws elbv2 describe-target-health \
     --target-group-arn <target-group-arn> \
     --profile totogi-runtime \
     --region ap-southeast-1
   ```

2. **Check Container Logs**
   ```bash
   # Inside container
   tail -f /var/log/tmf-server.log
   ```

---

## Quick Reference Commands

```bash
# === AWS Profile Setup ===
export AWS_PROFILE=totogi-runtime
export AWS_DEFAULT_REGION=ap-southeast-1

# === Get Task ID ===
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-service --query 'taskArns[0]' --output text)
echo $TASK_ARN

# === Connect to Container ===
aws ecs execute-command --cluster bssmagic-cluster --task $TASK_ARN --container bssmagic-runtime --interactive --command "/bin/bash"

# === Inside Container: Connect to DB ===
PGPASSWORD=admin psql -h localhost -U admin -d bssmagic_runtime

# === Test TMF API ===
curl "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/mappings" | jq

# === Restart Service ===
aws ecs update-service --cluster bssmagic-cluster --service bssmagic-service --force-new-deployment
```

---

## Security Notes

1. **Credentials**: AWS credentials should be stored securely, never committed to git
2. **ECS Exec Logging**: All ECS Exec sessions are logged to CloudTrail
3. **Database Access**: PostgreSQL uses local authentication only (no external access)
4. **Load Balancer**: HTTP only (no HTTPS configured in development)










