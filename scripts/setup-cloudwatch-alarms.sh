#!/bin/bash
# =============================================================================
# BSS Magic Runtime - CloudWatch Alarms Setup
# =============================================================================
# Creates CloudWatch alarms for monitoring ECS services
# Run: ./setup-cloudwatch-alarms.sh
# =============================================================================

set -e

export AWS_PROFILE=totogi-runtime
export AWS_DEFAULT_REGION=ap-southeast-1

CLUSTER_NAME="bssmagic-cluster"
SNS_TOPIC_NAME="bssmagic-alerts"

echo "=========================================="
echo "BSS Magic - CloudWatch Alarms Setup"
echo "=========================================="

# -----------------------------------------------------------------------------
# Create SNS Topic for alerts (if not exists)
# -----------------------------------------------------------------------------
echo ""
echo "Creating SNS topic for alerts..."
SNS_TOPIC_ARN=$(aws sns create-topic --name "$SNS_TOPIC_NAME" --query 'TopicArn' --output text 2>/dev/null || \
  aws sns list-topics --query "Topics[?ends_with(TopicArn, ':$SNS_TOPIC_NAME')].TopicArn | [0]" --output text)
echo "SNS Topic ARN: $SNS_TOPIC_ARN"

# -----------------------------------------------------------------------------
# Function to create alarms for a service
# -----------------------------------------------------------------------------
create_service_alarms() {
    local SERVICE_NAME=$1
    local FRIENDLY_NAME=$2
    
    echo ""
    echo "Creating alarms for $FRIENDLY_NAME ($SERVICE_NAME)..."
    
    # CPU High Alarm (> 80% for 5 minutes)
    aws cloudwatch put-metric-alarm \
        --alarm-name "${FRIENDLY_NAME}-CPU-High" \
        --alarm-description "CPU utilization > 80% for $FRIENDLY_NAME" \
        --metric-name CPUUtilization \
        --namespace AWS/ECS \
        --statistic Average \
        --period 300 \
        --threshold 80 \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=ClusterName,Value=$CLUSTER_NAME Name=ServiceName,Value=$SERVICE_NAME \
        --evaluation-periods 1 \
        --alarm-actions $SNS_TOPIC_ARN \
        --ok-actions $SNS_TOPIC_ARN \
        --treat-missing-data notBreaching
    echo "  ✅ CPU High alarm created"
    
    # Memory High Alarm (> 85% for 5 minutes)
    aws cloudwatch put-metric-alarm \
        --alarm-name "${FRIENDLY_NAME}-Memory-High" \
        --alarm-description "Memory utilization > 85% for $FRIENDLY_NAME" \
        --metric-name MemoryUtilization \
        --namespace AWS/ECS \
        --statistic Average \
        --period 300 \
        --threshold 85 \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=ClusterName,Value=$CLUSTER_NAME Name=ServiceName,Value=$SERVICE_NAME \
        --evaluation-periods 1 \
        --alarm-actions $SNS_TOPIC_ARN \
        --ok-actions $SNS_TOPIC_ARN \
        --treat-missing-data notBreaching
    echo "  ✅ Memory High alarm created"
    
    # Memory Critical Alarm (> 95% for 2 minutes)
    aws cloudwatch put-metric-alarm \
        --alarm-name "${FRIENDLY_NAME}-Memory-Critical" \
        --alarm-description "CRITICAL: Memory utilization > 95% for $FRIENDLY_NAME" \
        --metric-name MemoryUtilization \
        --namespace AWS/ECS \
        --statistic Maximum \
        --period 60 \
        --threshold 95 \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=ClusterName,Value=$CLUSTER_NAME Name=ServiceName,Value=$SERVICE_NAME \
        --evaluation-periods 2 \
        --alarm-actions $SNS_TOPIC_ARN \
        --treat-missing-data notBreaching
    echo "  ✅ Memory Critical alarm created"
    
    # Running Task Count (< 1 for 2 minutes = service down)
    aws cloudwatch put-metric-alarm \
        --alarm-name "${FRIENDLY_NAME}-No-Running-Tasks" \
        --alarm-description "No running tasks for $FRIENDLY_NAME - service may be down" \
        --metric-name RunningTaskCount \
        --namespace ECS/ContainerInsights \
        --statistic Minimum \
        --period 60 \
        --threshold 1 \
        --comparison-operator LessThanThreshold \
        --dimensions Name=ClusterName,Value=$CLUSTER_NAME Name=ServiceName,Value=$SERVICE_NAME \
        --evaluation-periods 2 \
        --alarm-actions $SNS_TOPIC_ARN \
        --ok-actions $SNS_TOPIC_ARN \
        --treat-missing-data breaching
    echo "  ✅ No Running Tasks alarm created"
}

# -----------------------------------------------------------------------------
# Create alarms for each service
# -----------------------------------------------------------------------------
create_service_alarms "bssmagic-service" "BSS-Magic-Runtime-Prod"
create_service_alarms "bssmagic-runtime-sandbox" "BSS-Magic-Runtime-Sandbox"
create_service_alarms "bssmagic-middleware" "BSS-Magic-Middleware"

# -----------------------------------------------------------------------------
# ALB Health Check Alarm
# -----------------------------------------------------------------------------
echo ""
echo "Creating ALB health alarms..."

# Get target group ARNs
PROD_TG_ARN=$(aws elbv2 describe-target-groups --names bssmagic-tmf-tg --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")
SANDBOX_TG_ARN=$(aws elbv2 describe-target-groups --names bssmagic-runtime-sandbox-tg --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")
MW_TG_ARN=$(aws elbv2 describe-target-groups --names bssmagic-mw-dashboard --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")
ALB_ARN=$(aws elbv2 describe-load-balancers --names bssmagic-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || echo "")

if [ -n "$PROD_TG_ARN" ] && [ -n "$ALB_ARN" ]; then
    # Extract the suffix parts for dimensions
    TG_SUFFIX=$(echo $PROD_TG_ARN | sed 's/.*targetgroup\//targetgroup\//')
    ALB_SUFFIX=$(echo $ALB_ARN | sed 's/.*loadbalancer\///')
    
    aws cloudwatch put-metric-alarm \
        --alarm-name "BSS-Magic-Runtime-Prod-Unhealthy-Hosts" \
        --alarm-description "Unhealthy hosts in production target group" \
        --metric-name UnHealthyHostCount \
        --namespace AWS/ApplicationELB \
        --statistic Average \
        --period 60 \
        --threshold 0 \
        --comparison-operator GreaterThanThreshold \
        --dimensions Name=TargetGroup,Value=$TG_SUFFIX Name=LoadBalancer,Value=$ALB_SUFFIX \
        --evaluation-periods 2 \
        --alarm-actions $SNS_TOPIC_ARN \
        --ok-actions $SNS_TOPIC_ARN \
        --treat-missing-data notBreaching
    echo "  ✅ ALB Unhealthy Hosts alarm created for Production"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "CloudWatch Alarms Setup Complete!"
echo "=========================================="
echo ""
echo "Created alarms:"
echo "  • BSS-Magic-Runtime-Prod-CPU-High"
echo "  • BSS-Magic-Runtime-Prod-Memory-High"
echo "  • BSS-Magic-Runtime-Prod-Memory-Critical"
echo "  • BSS-Magic-Runtime-Prod-No-Running-Tasks"
echo "  • BSS-Magic-Runtime-Sandbox-CPU-High"
echo "  • BSS-Magic-Runtime-Sandbox-Memory-High"
echo "  • BSS-Magic-Runtime-Sandbox-Memory-Critical"
echo "  • BSS-Magic-Runtime-Sandbox-No-Running-Tasks"
echo "  • BSS-Magic-Middleware-CPU-High"
echo "  • BSS-Magic-Middleware-Memory-High"
echo "  • BSS-Magic-Middleware-Memory-Critical"
echo "  • BSS-Magic-Middleware-No-Running-Tasks"
echo "  • BSS-Magic-Runtime-Prod-Unhealthy-Hosts"
echo ""
echo "SNS Topic: $SNS_TOPIC_ARN"
echo ""
echo "⚠️  IMPORTANT: Subscribe to the SNS topic to receive alerts:"
echo "   aws sns subscribe --topic-arn $SNS_TOPIC_ARN --protocol email --notification-endpoint YOUR_EMAIL"
echo ""
echo "View alarms in AWS Console:"
echo "   https://ap-southeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-southeast-1#alarmsV2:"
echo ""
