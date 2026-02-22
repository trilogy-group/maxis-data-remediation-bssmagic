#!/bin/bash
# =============================================================================
# Deploy All Custom Types and Views to Sandbox Runtime
# =============================================================================

set -e

export AWS_PROFILE=totogi-runtime
export AWS_DEFAULT_REGION=ap-southeast-1

echo "=========================================="
echo "BSS Magic SANDBOX - Full Deployment"
echo "=========================================="

# Get task ARN
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-runtime-sandbox --query 'taskArns[0]' --output text)
echo "Sandbox Task: $TASK_ARN"

# Copy TMF types file
echo ""
echo "=== Step 1: Copying TMF types to container ==="
cat tmf.sql | aws ecs execute-command \
    --cluster bssmagic-cluster \
    --task $TASK_ARN \
    --container bssmagic-runtime-sandbox \
    --interactive \
    --command "bash -c 'cat > /tmp/tmf.sql'"

# Apply TMF types
echo ""
echo "=== Step 2: Applying TMF custom types ==="
aws ecs execute-command \
    --cluster bssmagic-cluster \
    --task $TASK_ARN \
    --container bssmagic-runtime-sandbox \
    --interactive \
    --command "bash -c 'PGPASSWORD=admin psql -h localhost -U admin -d bssmagic_runtime -f /tmp/tmf.sql'" 2>&1 | grep -E "DROP|CREATE|ERROR|SCHEMA" | head -20

# Apply each view
echo ""
echo "=== Step 3: Applying all custom views ==="

cd views

apply_view() {
    local view_file="$1"
    local view_name=$(basename "$view_file" .sql)
    
    echo ""
    echo "--- Applying $view_name ---"
    
    # Copy SQL file to container
    cat "$view_file" | aws ecs execute-command \
        --cluster bssmagic-cluster \
        --task $TASK_ARN \
        --container bssmagic-runtime-sandbox \
        --interactive \
        --command "bash -c 'cat > /tmp/view.sql'" 2>/dev/null
    
    # Execute SQL
    aws ecs execute-command \
        --cluster bssmagic-cluster \
        --task $TASK_ARN \
        --container bssmagic-runtime-sandbox \
        --interactive \
        --command "bash -c 'PGPASSWORD=admin psql -h localhost -U admin -d bssmagic_runtime -f /tmp/view.sql'" 2>&1 | grep -E "DROP|CREATE|ERROR" || echo "  ✓ Applied"
}

# Core views
CORE_VIEWS=(
    "shoppingCart.sql"
    "productOrder.sql"
    "service.sql"
    "product.sql"
    "individual.sql"
    "organization.sql"
    "billingAccount.sql"
)

echo "Core TMF Views:"
for view in "${CORE_VIEWS[@]}"; do
    if [ -f "$view" ]; then
        apply_view "$view"
    fi
done

# Migration & remediation views
MIGRATION_VIEWS=(
    "failedMigrationProduct.sql"
    "failedMigrationSolutions.sql"
    "serviceProblem.sql"
    "serviceProblemEventRecord.sql"
    "task.sql"
    "serviceAttachment.sql"
)

echo ""
echo "Migration & Remediation Views:"
for view in "${MIGRATION_VIEWS[@]}"; do
    if [ -f "$view" ]; then
        apply_view "$view"
    fi
done

# 1867 OE Foreign Tables (REST FDW -> Salesforce Apex REST)
OE_TABLES=(
    "oe_foreign_tables.sql"
)

echo ""
echo "1867 OE REST FDW Foreign Tables:"
for view in "${OE_TABLES[@]}"; do
    if [ -f "$view" ]; then
        apply_view "$view"
    fi
done

# 1867 solution views
SOLUTION_VIEWS=(
    "solution1867FibreVoice.sql"
    "solution1867FibreOnly.sql"
    "solution1867MobileEsms.sql"
    "solution1867AccessVoice.sql"
)

echo ""
echo "1867 Solution Detection Views:"
for view in "${SOLUTION_VIEWS[@]}"; do
    if [ -f "$view" ]; then
        apply_view "$view"
    fi
done

echo ""
echo "=========================================="
echo "✓ SANDBOX DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "Test with:"
echo "  curl -H 'X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282' \\"
echo "    -H 'X-Environment: sandbox' \\"
echo "    'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product?limit=1'"
