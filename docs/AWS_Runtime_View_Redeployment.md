# AWS Runtime View Redeployment Guide

## Overview

When the AWS runtime is reinitialized (e.g., to add custom fields to TMF schema via `tmf.sql`), all custom SQL views in `salesforce_server` schema are lost and must be redeployed.

## When Redeployment is Required

1. **ECS Force New Deployment** - `aws ecs update-service --force-new-deployment`
2. **Schema Changes** - Modifying `tmf.sql` or `types.json`
3. **Container Restart** - Any restart of the ECS container

## Views to Redeploy

Location: `/custom-runtime/views/`

### Core TMF Views
| View File | TMF API | Description |
|-----------|---------|-------------|
| `shoppingCart.sql` | `/shoppingCart` | Product Basket with cartItem + relatedParty + cartTotalPrice |
| `productOrder.sql` | `/productOrder` | Order management |
| `service.sql` | `/service` | Service with relatedParty, serviceRelationship, 1867 detection |
| `product.sql` | `/product` | Solution → Product with relatedParty |
| `individual.sql` | `/individual` | Contact with email via contactMedium |
| `organization.sql` | `/organization` | Account → Organization |
| `billingAccount.sql` | `/billingAccount` | Billing Account with contact reference |

### Migration & Remediation Views
| View File | TMF API | Description |
|-----------|---------|-------------|
| `failedMigrationProduct.sql` | - | Failed migration products |
| `failedMigrationSolutions.sql` | - | Failed migration solutions |
| `serviceProblem.sql` | `/serviceProblem` | TMF656 - Issue tracking |
| `serviceProblemEventRecord.sql` | `/serviceProblemEventRecord` | TMF656 - Apex job details from AsyncApexJob |

## Redeployment Script

```bash
cd /Users/vladsorici/BSSMagic-RUNTIME/custom-runtime/views
./apply_all_views.sh
```

## Manual Redeployment

```bash
export AWS_PROFILE=totogi-runtime AWS_DEFAULT_REGION=ap-southeast-1
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-service --query 'taskArns[0]' --output text)

# Deploy a single view
cat product.sql | base64 | tr -d '\n' > /tmp/view.txt
SQL_B64=$(cat /tmp/view.txt)
aws ecs execute-command --cluster bssmagic-cluster --task $TASK_ARN --container bssmagic-runtime --interactive --command "bash -c 'echo \"$SQL_B64\" | base64 -d | psql -U postgres -d bssmagic'"
```

## Post-Redeployment Verification

```bash
# Test each API
curl -s -H "X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282" \
  "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product?limit=1" | jq '.| length'

curl -s -H "X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282" \
  "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/service?limit=1" | jq '.| length'
```

## Important Notes

- Always trigger **Salesforce foreign table import** after ECS restart before applying views
- Wait ~3 minutes after restart for container to fully initialize
- Internal tables (`tmf.serviceProblem`) persist but may be empty after restart
