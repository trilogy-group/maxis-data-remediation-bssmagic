#!/bin/bash
set -e

export AWS_PROFILE=totogi-runtime
export AWS_DEFAULT_REGION=ap-southeast-1

ACCOUNT_ID=652413721990
ECR_REPO="$ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/bssmagic-maxis-platform"
CLUSTER="bssmagic-cluster"
SERVICE="bssmagic-maxis-platform"
TASK_FAMILY="bssmagic-maxis-platform"
IMAGE_TAG="${1:-latest}"

echo "=========================================="
echo "Maxis Platform - AWS Deployment"
echo "=========================================="
echo ""

# Step 1: Create ECR repository if it doesn't exist
echo "Step 1: Ensuring ECR repository exists..."
aws ecr describe-repositories --repository-names bssmagic-maxis-platform 2>/dev/null || \
  aws ecr create-repository --repository-name bssmagic-maxis-platform --image-scanning-configuration scanOnPush=true
echo ""

# Step 2: Create CloudWatch log group
echo "Step 2: Ensuring log group exists..."
aws logs create-log-group --log-group-name /ecs/bssmagic-maxis-platform 2>/dev/null || true
echo ""

# Step 3: Start CodeBuild (if project exists) or direct push
echo "Step 3: Building..."
if aws codebuild batch-get-projects --names bssmagic-maxis-platform-build --query 'projects[0].name' --output text 2>/dev/null | grep -q "maxis-platform"; then
  echo "  Using CodeBuild project..."
  BUILD_ID=$(aws codebuild start-build --project-name bssmagic-maxis-platform-build --query 'build.id' --output text)
  echo "  Build started: $BUILD_ID"
  echo "  Monitor: aws codebuild batch-get-builds --ids $BUILD_ID --query 'builds[0].buildStatus'"
else
  echo "  No CodeBuild project found. Creating one..."
  echo ""
  echo "  Run this to create the CodeBuild project:"
  echo ""
  echo "  aws codebuild create-project \\"
  echo "    --name bssmagic-maxis-platform-build \\"
  echo "    --source type=NO_SOURCE,buildspec='$(cat buildspec.yml | base64)' \\"
  echo "    --artifacts type=NO_ARTIFACTS \\"
  echo "    --environment type=LINUX_CONTAINER,computeType=BUILD_GENERAL1_SMALL,image=aws/codebuild/standard:7.0,privilegedMode=true \\"
  echo "    --service-role arn:aws:iam::$ACCOUNT_ID:role/codebuild-bssmagic-service-role"
  echo ""
  echo "  Or push directly (requires Docker):"
  echo "    aws ecr get-login-password | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com"
  echo "    docker build -t $ECR_REPO:$IMAGE_TAG ."
  echo "    docker push $ECR_REPO:$IMAGE_TAG"
fi
echo ""

# Step 4: Register task definition
echo "Step 4: Registering task definition..."
TASK_ARN=$(aws ecs register-task-definition --cli-input-json file://task-definition.json --query 'taskDefinition.taskDefinitionArn' --output text)
echo "  Task: $TASK_ARN"
echo ""

# Step 5: Create or update ECS service
echo "Step 5: Updating ECS service..."
if aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].status' --output text 2>/dev/null | grep -q "ACTIVE"; then
  echo "  Updating existing service..."
  aws ecs update-service --cluster $CLUSTER --service $SERVICE --task-definition $TASK_ARN --force-new-deployment > /dev/null
else
  echo "  Creating new service..."
  echo "  NOTE: You need to create a target group and ALB listener rule first."
  echo "  Then run:"
  echo "    aws ecs create-service \\"
  echo "      --cluster $CLUSTER \\"
  echo "      --service-name $SERVICE \\"
  echo "      --task-definition $TASK_ARN \\"
  echo "      --desired-count 1 \\"
  echo "      --launch-type FARGATE \\"
  echo "      --network-configuration 'awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}'"
fi
echo ""

echo "=========================================="
echo "Deployment initiated!"
echo "=========================================="
echo ""
echo "Monitor: aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].{status:status,running:runningCount,desired:desiredCount}'"
