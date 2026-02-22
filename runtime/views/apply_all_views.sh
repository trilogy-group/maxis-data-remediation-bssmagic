#!/bin/bash
# =============================================================================
# BSS Magic Runtime - Apply All SQL Views
# =============================================================================
# Run this after each container redeployment to restore views.
# PostgreSQL is ephemeral - views are lost on restart!
# =============================================================================

set -e

export AWS_PROFILE=totogi-runtime
export AWS_DEFAULT_REGION=ap-southeast-1

echo "=========================================="
echo "BSS Magic Runtime - Apply All Views"
echo "=========================================="

echo ""
echo "Getting current task ARN..."
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-service --query 'taskArns[0]' --output text)
echo "Task: $TASK_ARN"

VIEWS_DIR="$(dirname "$0")"

apply_view() {
    local view_file="$1"
    local view_name=$(basename "$view_file" .sql)
    
    echo ""
    echo "=== Applying $view_name ==="
    
    SQL_B64=$(cat "$view_file" | base64 | tr -d '\n')
    
    aws ecs execute-command \
        --cluster bssmagic-cluster \
        --task $TASK_ARN \
        --container bssmagic-runtime \
        --interactive \
        --command "bash -c 'echo \"$SQL_B64\" | base64 -d | psql -U postgres -d bssmagic'" 2>&1 | grep -E "DROP|CREATE|ERROR" || true
}

# =============================================================================
# REST FDW FOREIGN TABLES (must be created before TMF views)
# =============================================================================
echo ""
echo "=========================================="
echo "REST FDW FOREIGN TABLES"
echo "=========================================="

REST_TABLES=(
    "rest_foreign_tables.sql"   # Solution Management: schema + user mapping + 4 foreign tables
    "oe_foreign_tables.sql"     # OE Remediation (1867): 3 foreign tables for migrated-services API
)

for view in "${REST_TABLES[@]}"; do
    if [ -f "$VIEWS_DIR/$view" ]; then
        apply_view "$VIEWS_DIR/$view"
    fi
done

# =============================================================================
# CORE TMF VIEWS (apply these in order)
# =============================================================================
echo ""
echo "=========================================="
echo "CORE TMF VIEWS"
echo "=========================================="

CORE_VIEWS=(
    "shoppingCart.sql"
    "productOrder.sql"
    "service.sql"           # Enhanced with 1867 detection fields (x_has1867Issue, etc.)
    "product.sql"
    "individual.sql"
    "organization.sql"      # TMF632 Organization (from Account)
    "billingAccount.sql"    # TMF BillingAccount with x_contactId for PIC Email lookup
)

for view in "${CORE_VIEWS[@]}"; do
    if [ -f "$VIEWS_DIR/$view" ]; then
        apply_view "$VIEWS_DIR/$view"
    fi
done

# =============================================================================
# MIGRATION & REMEDIATION VIEWS
# =============================================================================
echo ""
echo "=========================================="
echo "MIGRATION & REMEDIATION VIEWS"
echo "=========================================="

OTHER_VIEWS=(
    "batchJob.sql"                    # Custom BatchJob/BatchSchedule for batch remediation
    "failedMigrationProduct.sql"
    "failedMigrationSolutions.sql"
    "serviceProblem.sql"              # TMF656 - Confirmed issues & remediation tracking
    "serviceProblemEventRecord.sql"   # TMF656 - Apex job details from AsyncApexJob
)

for view in "${OTHER_VIEWS[@]}"; do
    if [ -f "$VIEWS_DIR/$view" ]; then
        apply_view "$VIEWS_DIR/$view"
    fi
done

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "=========================================="
echo "ALL VIEWS APPLIED!"
echo "=========================================="
echo ""
echo "Test Core Views:"
echo "  curl -H 'X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282' \\"
echo "    'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/shoppingCart/v5/shoppingCart?limit=1'"
echo ""
echo "  curl -H 'X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282' \\"
echo "    'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product?limit=1'"
echo ""
echo "Test 1867 Detection (via enhanced service view):"
echo "  curl -H 'X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282' \\"
echo "    'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/service?x_has1867Issue=true&limit=10'"
echo ""
echo "Test Organization (from Account):"
echo "  curl -H 'X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282' \\"
echo "    'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/organization?limit=1'"
echo ""