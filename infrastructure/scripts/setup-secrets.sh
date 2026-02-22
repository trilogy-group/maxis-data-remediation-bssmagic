#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENVIRONMENT_NAME=${ENVIRONMENT_NAME:-bssmagic}
AWS_REGION=${AWS_REGION:-us-east-1}

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       BSS Magic Runtime - Secrets Setup                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
echo "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured. Run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ AWS credentials verified${NC}"
echo ""

# Prompt for Salesforce credentials
echo -e "${YELLOW}Enter your Salesforce credentials:${NC}"
echo ""

read -p "Salesforce Client ID: " SF_CLIENT_ID
read -p "Salesforce Client Secret: " SF_CLIENT_SECRET
read -p "Salesforce Username: " SF_USERNAME
read -sp "Salesforce Password (with security token): " SF_PASSWORD
echo ""
read -p "Salesforce Login Server (e.g., https://test.salesforce.com or https://login.salesforce.com): " SF_LOGIN_SERVER

echo ""
echo "Creating/updating secrets in AWS Secrets Manager..."

# Create the secret JSON
SECRET_JSON=$(cat <<EOF
{
    "client_id": "${SF_CLIENT_ID}",
    "client_secret": "${SF_CLIENT_SECRET}",
    "username": "${SF_USERNAME}",
    "password": "${SF_PASSWORD}",
    "login_server": "${SF_LOGIN_SERVER}"
}
EOF
)

SECRET_NAME="${ENVIRONMENT_NAME}/salesforce-credentials"

# Check if secret exists
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" &> /dev/null; then
    echo "Updating existing secret..."
    aws secretsmanager put-secret-value \
        --secret-id "$SECRET_NAME" \
        --secret-string "$SECRET_JSON" \
        --region "$AWS_REGION"
    echo -e "${GREEN}✓ Secret updated successfully${NC}"
else
    echo "Creating new secret..."
    aws secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --description "Salesforce credentials for BSS Magic Runtime" \
        --secret-string "$SECRET_JSON" \
        --region "$AWS_REGION"
    echo -e "${GREEN}✓ Secret created successfully${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Setup Complete!                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Secret ARN: arn:aws:secretsmanager:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):secret:${SECRET_NAME}"
echo ""
echo "Next step: Run ./scripts/deploy.sh to deploy the infrastructure"


