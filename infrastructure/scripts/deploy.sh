#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENVIRONMENT_NAME=${ENVIRONMENT_NAME:-bssmagic}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="${ENVIRONMENT_NAME}-runtime"

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       BSS Magic Runtime - AWS Deployment                   ║${NC}"
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

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS Account: ${ACCOUNT_ID}${NC}"
echo -e "${GREEN}✓ Region: ${AWS_REGION}${NC}"
echo ""

# Check if secrets exist
SECRET_NAME="${ENVIRONMENT_NAME}/salesforce-credentials"
echo "Checking for Salesforce credentials in Secrets Manager..."
if ! aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" &> /dev/null; then
    echo -e "${RED}Error: Salesforce credentials not found in Secrets Manager.${NC}"
    echo -e "${YELLOW}Please run ./scripts/setup-secrets.sh first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Salesforce credentials found${NC}"
echo ""

# Deploy CloudFormation stack
echo -e "${BLUE}Deploying CloudFormation stack...${NC}"
echo "This may take 5-10 minutes."
echo ""

# Default parameters (can be overridden via environment variables)
TASK_CPU=${TASK_CPU:-2048}
TASK_MEMORY=${TASK_MEMORY:-4096}
DESIRED_COUNT=${DESIRED_COUNT:-1}
ALLOWED_CIDR=${ALLOWED_CIDR:-0.0.0.0/0}

echo -e "${YELLOW}Deployment Configuration:${NC}"
echo "  Environment:  ${ENVIRONMENT_NAME}"
echo "  CPU:          ${TASK_CPU}"
echo "  Memory:       ${TASK_MEMORY}MB"
echo "  Tasks:        ${DESIRED_COUNT}"
echo "  Allowed CIDR: ${ALLOWED_CIDR}"
echo ""

aws cloudformation deploy \
    --template-file "${PROJECT_DIR}/cloudformation/infrastructure.yaml" \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
        EnvironmentName="${ENVIRONMENT_NAME}" \
        TaskCpu="${TASK_CPU}" \
        TaskMemory="${TASK_MEMORY}" \
        DesiredCount="${DESIRED_COUNT}" \
        AllowedCIDR="${ALLOWED_CIDR}" \
    --tags \
        Environment="${ENVIRONMENT_NAME}" \
        Project="BSS-Magic-Runtime" \
        ManagedBy="CloudFormation" \
    --no-fail-on-empty-changeset

echo ""
echo -e "${GREEN}✓ CloudFormation stack deployed successfully${NC}"
echo ""

# Get outputs
echo -e "${BLUE}Retrieving deployment information...${NC}"
echo ""

ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ALBDNSName'].OutputValue" \
    --output text)

TMF_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='TMFAPIURL'].OutputValue" \
    --output text)

HEALTH_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='HealthURL'].OutputValue" \
    --output text)

DOCS_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='APIDocsURL'].OutputValue" \
    --output text)

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                Deployment Complete!                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Endpoints:${NC}"
echo ""
echo -e "  TMF API:      ${BLUE}${TMF_URL}${NC}"
echo -e "  API Docs:     ${BLUE}${DOCS_URL}${NC}"
echo -e "  Health:       ${BLUE}${HEALTH_URL}${NC}"
echo -e "  ALB DNS:      ${BLUE}${ALB_DNS}${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} The ECS service may take 2-3 minutes to become healthy."
echo "      Use the following command to check status:"
echo ""
echo -e "  ${BLUE}aws ecs describe-services --cluster ${ENVIRONMENT_NAME}-cluster --services ${ENVIRONMENT_NAME}-service --query 'services[0].{status:status,running:runningCount,desired:desiredCount}'${NC}"
echo ""
echo "To view logs:"
echo -e "  ${BLUE}aws logs tail /ecs/${ENVIRONMENT_NAME}-runtime --follow${NC}"
echo ""

