#!/bin/bash
# Build and push Docker image to AWS ECR
#
# Prerequisites:
#   1. AWS CLI configured with totogi-runtime profile
#   2. ECR repository created: bssmagic-middleware
#   3. Docker installed and running
#
# Usage:
#   ./docker/build-and-push.sh [tag]
#   
# Example:
#   ./docker/build-and-push.sh v1.0.0
#   ./docker/build-and-push.sh latest

set -e

# Configuration
AWS_PROFILE="totogi-runtime"
AWS_REGION="ap-southeast-1"
AWS_ACCOUNT_ID="652413721990"
ECR_REPO="bssmagic-middleware"
IMAGE_TAG="${1:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=====================================${NC}"
echo -e "${YELLOW}BSS Magic Middleware - Build & Push${NC}"
echo -e "${YELLOW}=====================================${NC}"

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

echo -e "\n${GREEN}1. Project root:${NC} $PROJECT_ROOT"

# Check if ts-dashboard directory exists (or the actual TS app directory)
TS_APP_DIR=""
if [ -d "ts-dashboard" ]; then
    TS_APP_DIR="ts-dashboard"
elif [ -d "01K5Z9VSEA0JG8ZVPCSC7CXVYR-5f4a7929-346a-4bfd-bd81-71f982b26563-2025-12-04T13-49-10-460Z (2)" ]; then
    # Create symlink for easier Docker build
    echo -e "\n${YELLOW}Creating symlink for TS Dashboard...${NC}"
    ln -sf "01K5Z9VSEA0JG8ZVPCSC7CXVYR-5f4a7929-346a-4bfd-bd81-71f982b26563-2025-12-04T13-49-10-460Z (2)" ts-dashboard
    TS_APP_DIR="ts-dashboard"
fi

if [ -z "$TS_APP_DIR" ]; then
    echo -e "${RED}ERROR: TypeScript Dashboard directory not found!${NC}"
    echo "Expected: ts-dashboard or the long UUID directory"
    exit 1
fi

echo -e "${GREEN}2. TS Dashboard:${NC} $TS_APP_DIR"

# Check 1147-gateway exists
if [ ! -d "1147-gateway" ]; then
    echo -e "${RED}ERROR: 1147-gateway directory not found!${NC}"
    exit 1
fi
echo -e "${GREEN}3. 1147-Gateway:${NC} Found"

# Check cloudsense-js-gateway (optional)
if [ -d "cloudsense-js-gateway" ]; then
    echo -e "${GREEN}4. JS Gateway:${NC} Found (will be included)"
else
    echo -e "${YELLOW}4. JS Gateway:${NC} Not found (will be skipped)"
fi

# Check batch-orchestrator
if [ -d "batch-orchestrator" ]; then
    echo -e "${GREEN}5. Batch Orchestrator:${NC} Found (will be included)"
else
    echo -e "${YELLOW}5. Batch Orchestrator:${NC} Not found (will be skipped)"
fi

# Login to ECR
echo -e "\n${YELLOW}5. Logging into ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION --profile $AWS_PROFILE | \
    docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Check if ECR repository exists, create if not
echo -e "\n${YELLOW}6. Checking ECR repository...${NC}"
if ! aws ecr describe-repositories --repository-names $ECR_REPO --region $AWS_REGION --profile $AWS_PROFILE > /dev/null 2>&1; then
    echo -e "${YELLOW}Creating ECR repository: $ECR_REPO${NC}"
    aws ecr create-repository --repository-name $ECR_REPO --region $AWS_REGION --profile $AWS_PROFILE
fi
echo -e "${GREEN}ECR repository ready:${NC} $ECR_REPO"

# Build Docker image
echo -e "\n${YELLOW}7. Building Docker image...${NC}"
FULL_IMAGE_NAME="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG"

docker build \
    -f docker/Dockerfile.combined \
    -t $ECR_REPO:$IMAGE_TAG \
    -t $FULL_IMAGE_NAME \
    .

echo -e "${GREEN}Image built:${NC} $ECR_REPO:$IMAGE_TAG"

# Push to ECR
echo -e "\n${YELLOW}8. Pushing to ECR...${NC}"
docker push $FULL_IMAGE_NAME

echo -e "\n${GREEN}=====================================${NC}"
echo -e "${GREEN}SUCCESS!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo -e "Image pushed to: ${YELLOW}$FULL_IMAGE_NAME${NC}"
echo -e "\nNext steps:"
echo -e "  1. Update ECS task definition with new image"
echo -e "  2. Update ECS service to use new task definition"
echo -e "  3. Or run: ${YELLOW}./docker/deploy-ecs.sh${NC}"
