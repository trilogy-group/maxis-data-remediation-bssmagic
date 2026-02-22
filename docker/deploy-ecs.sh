#!/bin/bash
# Deploy middleware container to AWS ECS
#
# Prerequisites:
#   1. Image already pushed to ECR (run build-and-push.sh first)
#   2. ECS cluster exists: bssmagic-cluster
#   3. Secrets configured in AWS Secrets Manager
#
# Usage:
#   ./docker/deploy-ecs.sh [image-tag]
#
# Example:
#   ./docker/deploy-ecs.sh v1.0.0
#   ./docker/deploy-ecs.sh latest

set -e

# Configuration
AWS_PROFILE="totogi-runtime"
AWS_REGION="ap-southeast-1"
AWS_ACCOUNT_ID="652413721990"
ECR_REPO="bssmagic-middleware"
ECS_CLUSTER="bssmagic-cluster"
ECS_SERVICE="bssmagic-middleware-service"
TASK_FAMILY="bssmagic-middleware"
IMAGE_TAG="${1:-latest}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=====================================${NC}"
echo -e "${YELLOW}BSS Magic Middleware - ECS Deploy${NC}"
echo -e "${YELLOW}=====================================${NC}"

FULL_IMAGE_NAME="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG"

echo -e "\n${GREEN}Image:${NC} $FULL_IMAGE_NAME"
echo -e "${GREEN}Cluster:${NC} $ECS_CLUSTER"
echo -e "${GREEN}Service:${NC} $ECS_SERVICE"

# Check if task definition exists
echo -e "\n${YELLOW}1. Checking task definition...${NC}"
TASK_DEF_EXISTS=$(aws ecs describe-task-definition \
    --task-definition $TASK_FAMILY \
    --region $AWS_REGION \
    --profile $AWS_PROFILE 2>/dev/null || echo "NOT_FOUND")

if [[ "$TASK_DEF_EXISTS" == "NOT_FOUND" ]]; then
    echo -e "${YELLOW}Task definition not found. Creating new one...${NC}"
    
    # Create task definition JSON
    cat > /tmp/task-definition.json << EOF
{
    "family": "$TASK_FAMILY",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "1024",
    "memory": "2048",
    "executionRoleArn": "arn:aws:iam::$AWS_ACCOUNT_ID:role/ecsTaskExecutionRole",
    "containerDefinitions": [
        {
            "name": "bssmagic-middleware",
            "image": "$FULL_IMAGE_NAME",
            "essential": true,
            "portMappings": [
                {"containerPort": 3000, "protocol": "tcp"},
                {"containerPort": 8080, "protocol": "tcp"},
                {"containerPort": 8081, "protocol": "tcp"}
            ],
            "environment": [
                {"name": "NODE_ENV", "value": "production"},
                {"name": "NEXT_PUBLIC_TMF_API_URL", "value": "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com"},
                {"name": "TMF_API_KEY", "value": "bssmagic-d58d6761265b01accc13e8b21bae8282"}
            ],
            "secrets": [
                {"name": "SF_USERNAME", "valueFrom": "arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:bssmagic/salesforce:username::"},
                {"name": "SF_PASSWORD", "valueFrom": "arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:bssmagic/salesforce:password::"},
                {"name": "SF_SECURITY_TOKEN", "valueFrom": "arn:aws:secretsmanager:$AWS_REGION:$AWS_ACCOUNT_ID:secret:bssmagic/salesforce:security_token::"}
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/bssmagic-middleware",
                    "awslogs-region": "$AWS_REGION",
                    "awslogs-stream-prefix": "ecs"
                }
            },
            "healthCheck": {
                "command": ["CMD-SHELL", "curl -f http://localhost:8081/health || exit 1"],
                "interval": 30,
                "timeout": 10,
                "retries": 3,
                "startPeriod": 60
            }
        }
    ]
}
EOF
    
    # Register task definition
    aws ecs register-task-definition \
        --cli-input-json file:///tmp/task-definition.json \
        --region $AWS_REGION \
        --profile $AWS_PROFILE
    
    echo -e "${GREEN}Task definition created${NC}"
else
    echo -e "${GREEN}Task definition exists. Creating new revision...${NC}"
    
    # Get current task definition and update image
    aws ecs describe-task-definition \
        --task-definition $TASK_FAMILY \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --query 'taskDefinition' | \
    jq --arg IMAGE "$FULL_IMAGE_NAME" \
        '.containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' \
    > /tmp/task-definition.json
    
    # Register new revision
    aws ecs register-task-definition \
        --cli-input-json file:///tmp/task-definition.json \
        --region $AWS_REGION \
        --profile $AWS_PROFILE > /dev/null
    
    echo -e "${GREEN}New task definition revision created${NC}"
fi

# Check if service exists
echo -e "\n${YELLOW}2. Checking ECS service...${NC}"
SERVICE_EXISTS=$(aws ecs describe-services \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $AWS_REGION \
    --profile $AWS_PROFILE \
    --query 'services[0].status' \
    --output text 2>/dev/null || echo "NOT_FOUND")

if [[ "$SERVICE_EXISTS" == "NOT_FOUND" || "$SERVICE_EXISTS" == "INACTIVE" ]]; then
    echo -e "${YELLOW}Service not found. You need to create it manually in AWS Console.${NC}"
    echo -e "\nTo create the service:"
    echo -e "  1. Go to ECS Console → Clusters → $ECS_CLUSTER"
    echo -e "  2. Create Service → Fargate → Task: $TASK_FAMILY"
    echo -e "  3. Configure VPC, subnets, security groups"
    echo -e "  4. Attach to ALB with target groups for ports 3000, 8080, 8081"
else
    echo -e "${GREEN}Service exists. Updating...${NC}"
    
    # Update service to use latest task definition
    aws ecs update-service \
        --cluster $ECS_CLUSTER \
        --service $ECS_SERVICE \
        --task-definition $TASK_FAMILY \
        --force-new-deployment \
        --region $AWS_REGION \
        --profile $AWS_PROFILE > /dev/null
    
    echo -e "${GREEN}Service updated. Deployment in progress...${NC}"
    
    # Wait for deployment
    echo -e "\n${YELLOW}3. Waiting for deployment to complete...${NC}"
    aws ecs wait services-stable \
        --cluster $ECS_CLUSTER \
        --services $ECS_SERVICE \
        --region $AWS_REGION \
        --profile $AWS_PROFILE
    
    echo -e "\n${GREEN}=====================================${NC}"
    echo -e "${GREEN}DEPLOYMENT COMPLETE!${NC}"
    echo -e "${GREEN}=====================================${NC}"
fi

# Cleanup
rm -f /tmp/task-definition.json

echo -e "\n${YELLOW}Service URLs (after ALB setup):${NC}"
echo -e "  Dashboard:      http://[ALB-DNS]:3000"
echo -e "  1147-Gateway:   http://[ALB-DNS]:8081"
echo -e "  JS Gateway:     http://[ALB-DNS]:8080"
echo -e "  Orchestrator:   http://[ALB-DNS]:8082"
