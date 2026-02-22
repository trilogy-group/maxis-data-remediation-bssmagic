# BSS Magic - AWS Infrastructure

CloudFormation-based deployment for production AWS environment.

## Components

- **ECS Fargate**: Runtime, orchestrator, gateways
- **Application Load Balancer**: Public endpoint with path routing
- **EFS**: Persistent storage for PostgreSQL data
- **Secrets Manager**: Encrypted credential storage
- **CloudWatch**: Logging + alarms

## Quick Deploy

```bash
./scripts/deploy.sh                      # Full infrastructure (~10 min)
./scripts/setup-secrets.sh               # Store Salesforce credentials
./scripts/upload-credentials-simple.sh creds.zip
./scripts/status.sh                      # Check health
```

## Maintenance

```bash
# View CloudWatch logs
aws logs tail /ecs/bssmagic-runtime --follow

# Access ECS container
export AWS_PROFILE=totogi-runtime AWS_DEFAULT_REGION=ap-southeast-1
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-service --query 'taskArns[0]' --output text)
aws ecs execute-command --cluster bssmagic-cluster --task $TASK_ARN --container bssmagic-runtime --interactive --command "/bin/bash"

# Cleanup (destroys all resources)
./scripts/cleanup.sh
```
