# 1147 Solution Empty Gateway

FastAPI service that executes Apex batch scripts for 1147 Solution Empty remediation via Salesforce Tooling API.

## Overview

This gateway automates the manual process of re-migrating failed solutions by executing three Apex batch scripts:
1. **DELETE** - Remove existing partial data from Heroku
2. **MIGRATE** - Re-push data from Salesforce to Heroku  
3. **UPDATE** - Update configuration metadata in Heroku

## Quick Start

### Prerequisites

- Python 3.11+
- Salesforce credentials (username, password, security token, connected app credentials)

### Setup

1. **Create `.env` file**:
```bash
cp .env.example .env
# Edit .env with your Salesforce credentials
```

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

3. **Run the service**:
```bash
python -m app.main
# Or with uvicorn directly:
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

4. **Access Swagger UI**:
```
http://localhost:8081/docs
```

### Docker

```bash
docker-compose up -d
```

## API Endpoints

### Health Check
```
GET /health
```

### Single Solution Remediation
```
POST /api/1147/remediate
{
  "solutionId": "a246D000000pOYsQAM",
  "action": "DELETE" | "MIGRATE" | "UPDATE"
}
```

### Full 3-Step Remediation
```
POST /api/1147/remediate-full
{
  "solutionId": "a246D000000pOYsQAM"
}
```

### Bulk Remediation
```
POST /api/1147/remediate-bulk
{
  "solutionIds": ["id1", "id2", "id3"],
  "action": "DELETE" | "MIGRATE" | "UPDATE"
}
```

## Integration with Dashboard

The TypeScript dashboard Fix button calls:
```
POST http://localhost:8081/api/1147/remediate-full
{
  "solutionId": "a246D000000pOYsQAM"
}
```

## Configuration

All settings are configured via environment variables (see `.env.example`).

## Troubleshooting

- **Authentication errors**: Check Salesforce credentials in `.env`
- **Compilation errors**: Verify Apex batch classes exist in Salesforce org
- **Timeout errors**: Increase timeout in `apex_executor.py`









