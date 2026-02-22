#!/bin/bash
# =============================================================================
# BSS Magic Runtime SANDBOX - Apply All SQL Views
# =============================================================================
# Run this after sandbox container deployment to restore views.
# PostgreSQL is ephemeral - views are lost on restart!
# =============================================================================

set -e

export AWS_PROFILE=totogi-runtime
export AWS_DEFAULT_REGION=ap-southeast-1

echo "=========================================="
echo "BSS Magic SANDBOX - Apply All Views"
echo "=========================================="

echo ""
echo "Getting sandbox task ARN..."
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-runtime-sandbox --query 'taskArns[0]' --output text)
echo "Sandbox Task: $TASK_ARN"

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
        --container bssmagic-runtime-sandbox \
        --interactive \
        --command "bash -c 'echo \"$SQL_B64\" | base64 -d | psql -U postgres -d bssmagic'" 2>&1 | grep -E "DROP|CREATE|ERROR" || true
}

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
    "failedMigrationProduct.sql"
    "failedMigrationSolutions.sql"
    "serviceProblem.sql"              # TMF656 - Confirmed issues & remediation tracking
    "serviceProblemEventRecord.sql"   # TMF656 - Apex job details from AsyncApexJob
    "task.sql"                        # Task view
    "serviceAttachment.sql"           # Service attachment view
)

for view in "${OTHER_VIEWS[@]}"; do
    if [ -f "$VIEWS_DIR/$view" ]; then
        apply_view "$VIEWS_DIR/$view"
    fi
done

# =============================================================================
# 1867 OE REST FDW FOREIGN TABLES
# =============================================================================
echo ""
echo "=========================================="
echo "1867 OE REST FDW FOREIGN TABLES"
echo "=========================================="

OE_TABLES=(
    "oe_foreign_tables.sql"     # OE Remediation (1867): 3 foreign tables for migrated-services API
)

for view in "${OE_TABLES[@]}"; do
    if [ -f "$VIEWS_DIR/$view" ]; then
        apply_view "$VIEWS_DIR/$view"
    fi
done

# =============================================================================
# 1867 SOLUTION DETECTION VIEWS
# =============================================================================
echo ""
echo "=========================================="
echo "1867 SOLUTION DETECTION VIEWS"
echo "=========================================="

SOLUTION_VIEWS=(
    "solution1867FibreVoice.sql"
    "solution1867FibreOnly.sql"
    "solution1867MobileEsms.sql"
    "solution1867AccessVoice.sql"
)

for view in "${SOLUTION_VIEWS[@]}"; do
    if [ -f "$VIEWS_DIR/$view" ]; then
        apply_view "$VIEWS_DIR/$view"
    fi
done

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "=========================================="
echo "ALL SANDBOX VIEWS APPLIED!"
echo "=========================================="
echo ""
echo "Test Sandbox via header X-Environment: sandbox"
echo ""
echo "Test Core Views:"
echo "  curl -H 'X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282' \\"
echo "    -H 'X-Environment: sandbox' \\"
echo "    'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/shoppingCart/v5/shoppingCart?limit=1'"
echo ""
echo "  curl -H 'X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282' \\"
echo "    -H 'X-Environment: sandbox' \\"
echo "    'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product?limit=1'"
echo ""
