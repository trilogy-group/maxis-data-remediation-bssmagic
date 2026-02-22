#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENVIRONMENT_NAME=${ENVIRONMENT_NAME:-bssmagic}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="${ENVIRONMENT_NAME}-runtime"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       BSS Magic Runtime - Deployment Status                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check CloudFormation stack
echo -e "${YELLOW}CloudFormation Stack:${NC}"
STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].StackStatus" \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" == "CREATE_COMPLETE" ] || [ "$STACK_STATUS" == "UPDATE_COMPLETE" ]; then
    echo -e "  Status: ${GREEN}${STACK_STATUS}${NC}"
else
    echo -e "  Status: ${RED}${STACK_STATUS}${NC}"
    exit 1
fi
echo ""

# Get ALB DNS
ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ALBDNSName'].OutputValue" \
    --output text 2>/dev/null)

# Check ECS Service
echo -e "${YELLOW}ECS Service:${NC}"
SERVICE_INFO=$(aws ecs describe-services \
    --cluster "${ENVIRONMENT_NAME}-cluster" \
    --services "${ENVIRONMENT_NAME}-service" \
    --region "$AWS_REGION" \
    --query "services[0].{status:status,running:runningCount,desired:desiredCount,pending:pendingCount}" \
    --output json 2>/dev/null)

if [ -n "$SERVICE_INFO" ]; then
    STATUS=$(echo "$SERVICE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])")
    RUNNING=$(echo "$SERVICE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['running'])")
    DESIRED=$(echo "$SERVICE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['desired'])")
    PENDING=$(echo "$SERVICE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['pending'])")
    
    echo -e "  Service Status: ${GREEN}${STATUS}${NC}"
    echo -e "  Tasks Running:  ${RUNNING}/${DESIRED}"
    if [ "$PENDING" -gt 0 ]; then
        echo -e "  Tasks Pending:  ${YELLOW}${PENDING}${NC}"
    fi
fi
echo ""

# Check health endpoint
echo -e "${YELLOW}Health Check:${NC}"
if [ -n "$ALB_DNS" ]; then
    HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "http://${ALB_DNS}:3000/health" 2>/dev/null || echo "000")
    if [ "$HEALTH_RESPONSE" == "200" ]; then
        echo -e "  Health Endpoint: ${GREEN}HEALTHY (HTTP 200)${NC}"
    else
        echo -e "  Health Endpoint: ${RED}UNHEALTHY (HTTP ${HEALTH_RESPONSE})${NC}"
    fi
fi
echo ""

# Display endpoints
echo -e "${YELLOW}Endpoints:${NC}"
if [ -n "$ALB_DNS" ]; then
    echo -e "  TMF API:      ${BLUE}http://${ALB_DNS}:8000${NC}"
    echo -e "  API Docs:     ${BLUE}http://${ALB_DNS}:8000/docs.html${NC}"
    echo -e "  Health:       ${BLUE}http://${ALB_DNS}:3000/health${NC}"
    echo -e "  Metadata:     ${BLUE}http://${ALB_DNS}:8000/metadata${NC}"
fi
echo ""

# Recent logs
echo -e "${YELLOW}Recent Logs (last 10 lines):${NC}"
aws logs tail "/ecs/${ENVIRONMENT_NAME}-runtime" \
    --region "$AWS_REGION" \
    --since 5m \
    --format short 2>/dev/null | tail -10 || echo "  No recent logs available"
echo ""


