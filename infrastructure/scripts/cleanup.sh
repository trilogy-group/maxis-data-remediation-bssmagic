#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENVIRONMENT_NAME=${ENVIRONMENT_NAME:-bssmagic}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="${ENVIRONMENT_NAME}-runtime"

echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║       BSS Magic Runtime - Cleanup AWS Resources            ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}WARNING: This will delete all AWS resources for the BSS Magic Runtime.${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "Deleting CloudFormation stack..."

# Delete the CloudFormation stack
aws cloudformation delete-stack \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION"

echo "Waiting for stack deletion to complete..."
aws cloudformation wait stack-delete-complete \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" || true

echo -e "${GREEN}✓ CloudFormation stack deleted${NC}"
echo ""

# Ask about secrets
read -p "Do you also want to delete the Salesforce credentials from Secrets Manager? (yes/no): " DELETE_SECRETS

if [ "$DELETE_SECRETS" == "yes" ]; then
    echo "Deleting secrets..."
    aws secretsmanager delete-secret \
        --secret-id "${ENVIRONMENT_NAME}/salesforce-credentials" \
        --force-delete-without-recovery \
        --region "$AWS_REGION" || true
    echo -e "${GREEN}✓ Secrets deleted${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 Cleanup Complete!                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""


