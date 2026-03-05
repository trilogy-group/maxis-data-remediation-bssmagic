# Internal Database Backups

This folder stores backups of the internal PostgreSQL database before container redeployments.

## Why Backups Are Needed

The ECS container's PostgreSQL is **ephemeral** - all custom tables are lost when:
- A new container task is created
- The container restarts
- `aws ecs update-service --force-new-deployment` is run

## What Gets Wiped

- Custom tables in `public` schema (e.g., `remediationTask`)
- Custom tables in `runtime` schema
- SQL views in `salesforce_server` schema

## What Persists

- TMF schema types (built into Docker image)
- FDW configuration (in Docker image)
- Salesforce data (lives in Salesforce, not PostgreSQL)

## Backup Commands

```bash
# Set environment
export AWS_PROFILE=totogi-runtime
export AWS_DEFAULT_REGION=ap-southeast-1
TASK_ARN=$(aws ecs list-tasks --cluster bssmagic-cluster --service-name bssmagic-service --query 'taskArns[0]' --output text)

# List custom tables
aws ecs execute-command --cluster bssmagic-cluster --task $TASK_ARN --container bssmagic-runtime --interactive --command "psql -U postgres -d bssmagic -c \"SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('public', 'runtime')\""

# Export specific table as CSV
aws ecs execute-command --cluster bssmagic-cluster --task $TASK_ARN --container bssmagic-runtime --interactive --command "psql -U postgres -d bssmagic -c 'COPY tablename TO STDOUT WITH CSV HEADER'" > tablename_$(date +%Y%m%d).csv

# Full schema dump
aws ecs execute-command --cluster bssmagic-cluster --task $TASK_ARN --container bssmagic-runtime --interactive --command "pg_dump -U postgres -d bssmagic --schema=public --schema=runtime" > internal_db_$(date +%Y%m%d).sql
```

## Restore Commands

After deploying a new container:

```bash
# 1. Wait for container to be ready (~2-3 min)
# 2. Apply SQL views
cd /Users/vladsorici/BSSMagic-RUNTIME/custom-runtime/views
./apply_all_views.sh

# 3. Restore custom tables from SQL dump
cat internal_db_YYYYMMDD.sql | aws ecs execute-command --cluster bssmagic-cluster --task $TASK_ARN --container bssmagic-runtime --interactive --command "psql -U postgres -d bssmagic"
```

## File Naming Convention

- `internal_db_YYYYMMDD.sql` - Full schema dump
- `remediationTask_YYYYMMDD.csv` - Remediation task table
- `<tablename>_YYYYMMDD.csv` - Other table exports
