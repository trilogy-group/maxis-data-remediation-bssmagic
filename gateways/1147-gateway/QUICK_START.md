# 1147 Gateway - Quick Start Guide

## ✅ Implementation Complete

The 1147 Gateway has been fully implemented according to the specification document. All components are ready to use.

## 🚀 Quick Start

### 1. Setup Environment

```bash
cd /Users/vladsorici/BSSMagic-RUNTIME/1147-gateway

# Run setup script (will prompt for credentials if needed)
./setup.sh

# Or manually create .env file from .env.example
cp .env.example .env
# Edit .env with your Salesforce credentials
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Start the Gateway

**Option A: Direct Python**
```bash
python -m app.main
# Or: uvicorn app.main:app --host 0.0.0.0 --port 8080
```

**Option B: Docker**
```bash
docker-compose up -d
```

### 4. Verify It's Running

```bash
# Health check
curl http://localhost:8081/health

# Swagger UI
open http://localhost:8081/docs
```

## 📋 Project Structure

```
1147-gateway/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration settings
│   ├── auth/
│   │   ├── __init__.py
│   │   └── salesforce.py    # OAuth authentication
│   ├── services/
│   │   ├── __init__.py
│   │   ├── apex_executor.py # Tooling API execution
│   │   └── script_generator.py # Apex script generation
│   └── models/
│       ├── __init__.py
│       └── schemas.py       # Pydantic models
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── setup.sh                 # Setup script
├── .env.example
└── README.md
```

## 🔌 API Endpoints

### Health Check
```
GET /health
```

### Single Action Remediation
```
POST /api/1147/remediate
{
  "solutionId": "a246D000000pOYsQAM",
  "action": "DELETE" | "MIGRATE" | "UPDATE"
}
```

### Full 3-Step Remediation (Recommended)
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

## 🔗 Dashboard Integration

The TypeScript dashboard Fix button is already connected! It calls:
```
POST http://localhost:8081/api/1147/remediate-full
```

The Fix button in the SolutionCard component will:
1. Call `/api/solutions/fix` (Next.js API route)
2. Which proxies to `http://localhost:8081/api/1147/remediate-full`
3. Execute all 3 steps: DELETE → MIGRATE → UPDATE
4. Return status and results

## ⚙️ Configuration

All settings are in `.env`:
- `SF_LOGIN_URL` - Salesforce login server
- `SF_INSTANCE` - Salesforce instance URL
- `SF_USERNAME` - Salesforce username
- `SF_PASSWORD` - Salesforce password
- `SF_SECURITY_TOKEN` - Security token (if separate from password)
- `SF_CLIENT_ID` - Connected App Consumer Key
- `SF_CLIENT_SECRET` - Connected App Consumer Secret

## 🧪 Testing

1. **Test with a real solution ID**:
```bash
curl -X POST http://localhost:8081/api/1147/remediate-full \
  -H "Content-Type: application/json" \
  -d '{"solutionId": "a246D000000pOYsQAM"}'
```

2. **Check Swagger UI**:
   - Open http://localhost:8081/docs
   - Try the endpoints interactively

## 📝 Next Steps

1. ✅ Gateway implemented
2. ✅ Dashboard connected
3. ⏳ Test with real solution (pending)
4. ⏳ Add batch job status monitoring (optional)
5. ⏳ Deploy to AWS (optional)

## 🐛 Troubleshooting

- **Connection refused**: Gateway not running on port 8081
- **Authentication errors**: Check Salesforce credentials in `.env`
- **Compilation errors**: Verify Apex batch classes exist in Salesforce org
- **Timeout errors**: Increase timeout in `apex_executor.py`









