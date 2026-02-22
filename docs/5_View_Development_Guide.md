# BSS Magic Runtime - Custom Schema Extension Guide

This guide explains how to add custom fields to TMF entities in the BSS Magic Runtime when the standard schema doesn't support a required field.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Extract Schema from Production Container](#step-1-extract-schema-from-production-container)
4. [Step 2: Identify the Entity to Modify](#step-2-identify-the-entity-to-modify)
5. [Step 3: Modify types.json](#step-3-modify-typesjson)
6. [Step 4: Modify tmf.sql](#step-4-modify-tmfsql)
7. [Step 5: Create/Update Dockerfile](#step-5-createupdate-dockerfile)
8. [Step 6: Build Custom Docker Image](#step-6-build-custom-docker-image)
9. [Step 7: Push to ECR](#step-7-push-to-ecr)
10. [Step 8: Deploy to ECS](#step-8-deploy-to-ecs)
11. [Step 9: Wait for FDW Discovery](#step-9-wait-for-fdw-discovery)
12. [Step 10: Apply SQL View with Custom Field](#step-10-apply-sql-view-with-custom-field)
13. [Step 11: Test the API](#step-11-test-the-api)
14. [Troubleshooting](#troubleshooting)
15. [Reference: Directory Structure](#reference-directory-structure)

---

## Overview

The BSS Magic Runtime uses a TMF server that requires schema definitions at design-time for each entity and field. When you need to add a custom field (e.g., `status` to `ShoppingCart`), you must:

1. Add the field to `types.json` (tells the Java TMF server about the field)
2. Add the field to `tmf.sql` (PostgreSQL schema definition)
3. Build a new Docker image with these modifications
4. Deploy to AWS ECS
5. Create/update the SQL view to include the field

---

## Prerequisites

### Required Tools
- Docker Desktop (running)
- AWS CLI v2
- Session Manager Plugin for AWS CLI
- `jq` (for JSON parsing)

### AWS Configuration
```bash
# Create/update AWS profile
aws configure --profile totogi-runtime
# Access Key ID: AKIAZPZXDLWDKEUEKBHZ
# Region: ap-southeast-1

# Set environment variables
export AWS_PROFILE=totogi-runtime
export AWS_DEFAULT_REGION=ap-southeast-1
```

### ECR Authentication
```bash
# Login to Totogi's production ECR (source image)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 008731404932.dkr.ecr.us-east-1.amazonaws.com

# Login to our ECR (destination)
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 652413721990.dkr.ecr.ap-southeast-1.amazonaws.com
```

---

## Step 1: Extract Schema from Production Container

**First time only** - Extract the schema files from the production container:

```bash
cd /Users/vladsorici/BSSMagic-RUNTIME/custom-runtime

# Extract schema files from production image
docker run --rm --entrypoint /bin/bash \
  008731404932.dkr.ecr.us-east-1.amazonaws.com/prod/bssmagic-runtime:latest -c "
    cat /docker-entrypoint-initdb.d/tmf.sql > /tmp/tmf.sql && \
    unzip -q /tmf-server-0.0.1-SNAPSHOT.jar 'BOOT-INF/classes/types.json' 'BOOT-INF/classes/specs/*' -d /tmp && \
    tar -C /tmp -c tmf.sql BOOT-INF
  " | tar -x
```

This creates:
- `tmf.sql` - PostgreSQL schema with TMF types and tables
- `BOOT-INF/classes/types.json` - Type definitions for the Java TMF server
- `BOOT-INF/classes/specs/` - OpenAPI specs (only needed if adding new entities)

---

## Step 2: Identify the Entity to Modify

Find the entity definition in `types.json`:

```bash
# Search for the entity (e.g., ShoppingCart)
grep -A20 '"ShoppingCart"' BOOT-INF/classes/types.json
```

Example output:
```json
"ShoppingCart": {
  "__type__": "object",
  "validFor": "TimePeriod",
  "contactMedium": "array<OneOfContactMedium>",
  "cartTotalPrice": "array<CartPrice>",
  "cartItem": "array<CartItem>",
  "relatedParty": "array<RelatedPartyOrPartyRole>",
  "creationDate": "string",
  "lastUpdate": "string",
  "href": "string",
  "id": "string",
  "@type": "string",
  "@baseType": "string",
  "@schemaLocation": "string"
},
```

---

## Step 3: Modify types.json

Add your custom field to the entity definition in `BOOT-INF/classes/types.json`:

```bash
# Edit the file
nano BOOT-INF/classes/types.json
# Or use your preferred editor
```

**Example: Adding `status` to ShoppingCart**

Before:
```json
"ShoppingCart": {
  "__type__": "object",
  "validFor": "TimePeriod",
  ...
  "relatedParty": "array<RelatedPartyOrPartyRole>",
  "creationDate": "string",
  ...
}
```

After:
```json
"ShoppingCart": {
  "__type__": "object",
  "validFor": "TimePeriod",
  ...
  "relatedParty": "array<RelatedPartyOrPartyRole>",
  "status": "string",
  "creationDate": "string",
  ...
}
```

### Field Type Reference

| types.json Type | Description | Example |
|-----------------|-------------|---------|
| `"string"` | Text field | `"status": "string"` |
| `"integer"` | Integer number | `"quantity": "integer"` |
| `"number"` | Decimal number | `"price": "number"` |
| `"boolean"` | True/false | `"isActive": "boolean"` |
| `"TypeName"` | Complex type | `"validFor": "TimePeriod"` |
| `"array<TypeName>"` | Array of type | `"items": "array<CartItem>"` |

---

## Step 4: Modify tmf.sql

Find and modify the corresponding type and table in `tmf.sql`:

```bash
# Find the type definition
grep -n "CREATE TYPE.*ShoppingCart" tmf.sql
```

**Modify TWO places:**

### 4a. The CREATE TYPE statement:

Find:
```sql
CREATE TYPE "ShoppingCart" AS (
  "validFor" "TimePeriod",
  ...
  "relatedParty" "RelatedPartyOrPartyRole"[],
  "creationDate" timestamp with time zone,
  ...
);
```

Add your field:
```sql
CREATE TYPE "ShoppingCart" AS (
  "validFor" "TimePeriod",
  ...
  "relatedParty" "RelatedPartyOrPartyRole"[],
  "status" text,
  "creationDate" timestamp with time zone,
  ...
);
```

### 4b. The CREATE TABLE statement:

Find:
```sql
CREATE TABLE "shoppingCart" (
  "validFor" "TimePeriod",
  ...
  "relatedParty" "RelatedPartyOrPartyRole"[],
  "creationDate" timestamp with time zone,
  ...
);
```

Add your field:
```sql
CREATE TABLE "shoppingCart" (
  "validFor" "TimePeriod",
  ...
  "relatedParty" "RelatedPartyOrPartyRole"[],
  "status" text,
  "creationDate" timestamp with time zone,
  ...
);
```

### SQL Type Mapping

| types.json | tmf.sql |
|------------|---------|
| `"string"` | `text` |
| `"integer"` | `integer` |
| `"number"` | `real` or `numeric` |
| `"boolean"` | `boolean` |
| `"TypeName"` | `"TypeName"` |
| `"array<TypeName>"` | `"TypeName"[]` |

---

## Step 5: Create/Update Dockerfile

Create `Dockerfile` in the `custom-runtime` directory:

```dockerfile
FROM 008731404932.dkr.ecr.us-east-1.amazonaws.com/prod/bssmagic-runtime:latest

# Copy modified PostgreSQL schema
COPY tmf.sql /docker-entrypoint-initdb.d/tmf.sql

# Copy modified types.json and update the JAR
WORKDIR /tmp/jarmod
COPY BOOT-INF ./BOOT-INF
RUN jar uf /tmf-server-0.0.1-SNAPSHOT.jar BOOT-INF/classes/types.json
RUN rm -rf /tmp/jarmod
WORKDIR /
```

---

## Step 6: Build Custom Docker Image

```bash
cd /Users/vladsorici/BSSMagic-RUNTIME/custom-runtime

# Build for linux/amd64 (required for AWS Fargate)
docker build --platform linux/amd64 --no-cache -t bssmagic-custom .
```

### Verify the Build

```bash
# Check that types.json was updated correctly
docker run --rm --entrypoint bash bssmagic-custom:latest -c \
  "unzip -p /tmf-server-0.0.1-SNAPSHOT.jar BOOT-INF/classes/types.json | grep -A15 'ShoppingCart'"
```

Ensure your custom field appears in the output.

---

## Step 7: Push to ECR

**IMPORTANT:** Check which tag the ECS task definition uses:

```bash
aws ecs describe-task-definition --task-definition bssmagic-runtime \
  --query 'taskDefinition.containerDefinitions[0].image' --output text
```

If it shows `:custom-v1`, use that tag:

```bash
# Tag with the correct tag (check task definition!)
docker tag bssmagic-custom:latest 652413721990.dkr.ecr.ap-southeast-1.amazonaws.com/bssmagic-runtime:custom-v1

# Push to ECR
docker push 652413721990.dkr.ecr.ap-southeast-1.amazonaws.com/bssmagic-runtime:custom-v1
```

---

## Step 8: Deploy to ECS

```bash
export AWS_PROFILE=totogi-runtime
export AWS_DEFAULT_REGION=ap-southeast-1

# Force new deployment
aws ecs update-service \
  --cluster bssmagic-cluster \
  --service bssmagic-service \
  --force-new-deployment

# Monitor deployment
watch -n 10 "aws ecs describe-services --cluster bssmagic-cluster --services bssmagic-service --query 'services[0].deployments[*].{status:status,running:runningCount,desired:desiredCount}' --output table"
```

Wait until:
- OLD deployment: `runningCount: 0`
- NEW deployment: `runningCount: 1`, `status: PRIMARY`

---

## Step 9: Wait for FDW Discovery

The new container needs time to discover Salesforce tables (~2-5 minutes):

```bash
# Check foreign tables count
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-service --query 'taskArns[0]' --output text)

aws ecs execute-command \
  --cluster bssmagic-cluster \
  --task $TASK_ARN \
  --container bssmagic-runtime \
  --interactive \
  --command "bash -c 'psql -U postgres -d bssmagic -c \"SELECT COUNT(*) FROM information_schema.foreign_tables WHERE foreign_table_schema = '\\''salesforce_server'\\'';\"'"
```

Repeat until count is > 0 (usually 800+ tables).

---

## Step 10: Apply SQL View with Custom Field

Create the view that maps Salesforce fields to TMF fields:

```bash
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-service --query 'taskArns[0]' --output text)

# Create SQL file
cat > /tmp/view.sql << 'SQLEOF'
DROP VIEW IF EXISTS salesforce_server."shoppingCart";
CREATE VIEW salesforce_server."shoppingCart" AS
SELECT
    NULL::tmf."TimePeriod" AS "validFor",
    NULL::tmf."OneOfContactMedium"[] AS "contactMedium",
    NULL::tmf."CartPrice"[] AS "cartTotalPrice",
    NULL::tmf."CartItem"[] AS "cartItem",
    NULL::tmf."RelatedPartyOrPartyRole"[] AS "relatedParty",
    t0."csordtelcoa__Basket_Stage__c"::text AS "status",
    t0."CreatedDate"::timestamp with time zone AS "creationDate",
    t0."LastModifiedDate"::timestamp with time zone AS "lastUpdate",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/shoppingCart/v5/shoppingCart/' || t0."Id")::text AS href,
    t0."Id"::text AS id,
    'ShoppingCart'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM salesforce_server."cscfga__Product_Basket__c" t0;
SQLEOF

# Apply view
SQL_B64=$(cat /tmp/view.sql | base64 | tr -d '\n')
aws ecs execute-command \
  --cluster bssmagic-cluster \
  --task $TASK_ARN \
  --container bssmagic-runtime \
  --interactive \
  --command "bash -c 'echo \"$SQL_B64\" | base64 -d | psql -U postgres -d bssmagic'"
```

---

## Step 11: Test the API

```bash
# Test API response
curl -s -H "X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282" \
  "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/shoppingCart/v5/shoppingCart?limit=3" | jq '.[0]'

# Test filtering by custom field
curl -s -H "X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282" \
  "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/shoppingCart/v5/shoppingCart?status=Submitted&limit=5" | jq 'length'
```

---

## Troubleshooting

### "types.json not updated in container"

**Cause:** JAR update command not working correctly.

**Solution:** Ensure Dockerfile uses correct path:
```dockerfile
WORKDIR /tmp/jarmod
COPY BOOT-INF ./BOOT-INF
RUN jar uf /tmf-server-0.0.1-SNAPSHOT.jar BOOT-INF/classes/types.json
```

### "Pushed to ECR but ECS not using new image"

**Cause:** Task definition uses different tag than `:latest`.

**Solution:** Check and use correct tag:
```bash
aws ecs describe-task-definition --task-definition bssmagic-runtime \
  --query 'taskDefinition.containerDefinitions[0].image' --output text
# If shows :custom-v1, push to that tag
```

### "FDW tables not appearing"

**Cause:** Auto-discovery takes time.

**Solution:** Wait 2-5 minutes, then call any API endpoint to trigger discovery:
```bash
curl -H "X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282" \
  "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/service?limit=1"
```

### "500 error after adding custom field"

**Cause:** Field in SQL view but not in types.json, or type mismatch.

**Solution:** 
1. Verify field exists in both `types.json` AND `tmf.sql`
2. Verify container has updated files
3. Check field types match

### "Cannot connect to ECS Exec"

**Solution:** Install Session Manager plugin:
```bash
# macOS
curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/mac/session-manager-plugin.pkg" -o "session-manager-plugin.pkg"
sudo installer -pkg session-manager-plugin.pkg -target /
```

---

## Reference: Directory Structure

```
/Users/vladsorici/BSSMagic-RUNTIME/custom-runtime/
├── Dockerfile                      # Build instructions
├── tmf.sql                         # PostgreSQL schema (modified)
└── BOOT-INF/
    └── classes/
        ├── types.json              # Type definitions (modified)
        └── specs/                  # OpenAPI specs (for new entities only)
            ├── TMF620_Product_Catalog_Management_v5.yaml
            ├── TMF622_Product_Ordering_Management_v5.yaml
            ├── TMF632_Party_Management_v5.yaml
            ├── TMF638_Service_Inventory_Management_v5.yaml
            ├── TMF663_Shopping_Cart_Management_v5.yaml
            └── ...
```

---

## Quick Reference Commands

```bash
# Set environment
export AWS_PROFILE=totogi-runtime
export AWS_DEFAULT_REGION=ap-southeast-1

# ECR login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 008731404932.dkr.ecr.us-east-1.amazonaws.com
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 652413721990.dkr.ecr.ap-southeast-1.amazonaws.com

# Build
cd /Users/vladsorici/BSSMagic-RUNTIME/custom-runtime
docker build --platform linux/amd64 --no-cache -t bssmagic-custom .

# Push (check correct tag!)
docker tag bssmagic-custom:latest 652413721990.dkr.ecr.ap-southeast-1.amazonaws.com/bssmagic-runtime:custom-v1
docker push 652413721990.dkr.ecr.ap-southeast-1.amazonaws.com/bssmagic-runtime:custom-v1

# Deploy
aws ecs update-service --cluster bssmagic-cluster --service bssmagic-service --force-new-deployment

# Get task ARN
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-service --query 'taskArns[0]' --output text)

# Execute SQL in container
aws ecs execute-command --cluster bssmagic-cluster --task $TASK_ARN --container bssmagic-runtime --interactive --command "bash -c 'psql -U postgres -d bssmagic'"

# Test API
curl -s -H "X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282" "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/shoppingCart/v5/shoppingCart?limit=1" | jq
```

---

## Version History

| Date | Change |
|------|--------|
| 2025-12-16 | Added `status` field to ShoppingCart entity |

---

*Last Updated: December 16, 2025*









