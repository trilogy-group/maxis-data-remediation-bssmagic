# BSS Magic Runtime - Complete Guide

**Last Updated**: December 16, 2025  
**Environment**: Maxis CloudSense Integration

---

## Overview

The BSS Magic Runtime is a Docker-based platform that provides:
- **PostgreSQL database** with Foreign Data Wrappers (FDW) for querying external systems
- **TMF API Server** exposing all 67 TM Forum V5 APIs
- **SQL query endpoint** for direct database access
- **Salesforce FDW** for real-time CloudSense data access

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      BSS Magic Runtime                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ TMF Server  │  │  PostgreSQL │  │   Salesforce FDW        │  │
│  │  (Java)     │  │             │  │ (Foreign Data Wrapper)  │  │
│  │             │  │  ┌───────┐  │  │                         │  │
│  │ All 67 TMF  │◄─┤  │ tmf   │  │◄─┤ Real-time CloudSense    │  │
│  │ V5 APIs     │  │  │schema │  │  │ data via SOQL→SQL       │  │
│  │             │  │  └───────┘  │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│         │                │                     │                │
│         └────────────────┼─────────────────────┘                │
│                          │                                      │
│                     ┌────▼────┐                                  │
│                     │ Views   │ ← SQL views map CloudSense      │
│                     │         │   objects to TMF entities       │
│                     └─────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## AWS Deployment

### Infrastructure Details

| Component | Value |
|-----------|-------|
| **AWS Account** | 652413721990 |
| **Region** | ap-southeast-1 (Singapore) |
| **ECS Cluster** | bssmagic-cluster |
| **Load Balancer URL** | http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com |
| **AWS Profile** | totogi-runtime |

### Access Credentials

```bash
# AWS Profile Configuration
aws configure --profile totogi-runtime
# Access Key ID: AKIAZPZXDLWDKEUEKBHZ
# Secret Access Key: [stored securely]
# Region: ap-southeast-1
# Output: json
```

### TMF API Endpoints

Base URL: `http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com`

| API | Endpoint | TMF Standard |
|-----|----------|--------------|
| Service | `/tmf-api/serviceInventoryManagement/v5/service` | TMF638 |
| Individual | `/tmf-api/partyManagement/v5/individual` | TMF632 |
| Organization | `/tmf-api/partyManagement/v5/organization` | TMF632 |
| ProductOrder | `/tmf-api/productOrderingManagement/v5/productOrder` | TMF622 |
| PartyAccount | `/tmf-api/accountManagement/v5/partyAccount` | TMF666 |
| BillingAccount | `/tmf-api/accountManagement/v5/billingAccount` | TMF666 |
| Product | `/tmf-api/productInventoryManagement/v5/product` | TMF637 |
| Mappings | `/mappings` | BSS Magic proprietary |

---

## TMF Entity Mapping Status

### Currently Working ✅

| TMF Entity | CloudSense Object | Status | Key Fields |
|------------|-------------------|--------|------------|
| Service (TMF638) | `csord__Service__c` | ✅ Working | id, name, state, serviceCharacteristic |
| Individual (TMF632) | `Contact` | ✅ Working | givenName, familyName, contactMedium |
| ProductOrder (TMF622) | `csord__Order__c` | ✅ Working | id, state, externalId, relatedParty |
| Organization (TMF632) | `Account` | ✅ Working | id, name, tradingName |
| PartyAccount (TMF666) | `Account` | ✅ Working | id, name, accountType |
| BillingAccount (TMF666) | `Account` | ✅ Working | id, name, state |

### Partial/Issues ⚠️

| TMF Entity | CloudSense Object | Issue |
|------------|-------------------|-------|
| Product (TMF637) | `csord__Subscription__c` | Currency casting error ("MYR" → real) |

### Pending ⏳

| TMF Entity | CloudSense Object | Notes |
|------------|-------------------|-------|
| ShoppingCart (TMF663) | `cscfga__Product_Basket__c` | Requires design-time schema registration |
| TaskFlow (TMF653) | `CSPOFA__Orchestration_Process__c` | SQL view ready, needs registration |
| Task (TMF653) | `CSPOFA__Orchestration_Step__c` | SQL view ready, needs registration |

---

## Database Schema

### PostgreSQL Schemas

| Schema | Purpose |
|--------|---------|
| `tmf` | TMF composite types (Service, Individual, ProductOrder, etc.) |
| `salesforce_server` | FDW tables mapping to Salesforce objects |
| `public` | Custom tables and local data |

### Key TMF Types

```sql
-- Example composite types in tmf schema
"tmf"."Service"
"tmf"."Individual"
"tmf"."ProductOrder"
"tmf"."ProductOrderStateType"
"tmf"."ExternalIdentifier"
"tmf"."RelatedPartyRefOrPartyRoleRef"
"tmf"."ContactMedium"
```

---

## Salesforce FDW Configuration

The runtime uses PostgreSQL Foreign Data Wrappers to query CloudSense (Salesforce) directly.

### Connected Salesforce Objects

```sql
-- List all imported Salesforce objects
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'salesforce_server';
```

**Key objects available:**
- `csord__Service__c` - Services
- `csord__Order__c` - Orders  
- `csord__Subscription__c` - Subscriptions
- `csord__Solution__c` - Solutions
- `cscfga__Product_Basket__c` - Product Baskets
- `cscfga__Product_Configuration__c` - Product Configurations
- `Account` - Accounts/Organizations
- `Contact` - Contacts/Individuals
- `csconta__Billing_Account__c` - Billing Accounts
- `CSPOFA__Orchestration_Process__c` - Orchestration Processes
- `CSPOFA__Orchestration_Step__c` - Orchestration Steps

### Triggering Auto-Discovery

If Salesforce objects are missing, trigger auto-discovery:

```sql
-- Import all Salesforce objects
IMPORT FOREIGN SCHEMA salesforce INTO salesforce_server;

-- Or import specific objects
IMPORT FOREIGN SCHEMA salesforce 
LIMIT TO (csord__Service__c, csord__Order__c, Contact)
INTO salesforce_server;
```

---

## Creating TMF Views

### View Creation Pattern

```sql
-- Standard TMF view pattern
CREATE OR REPLACE VIEW "salesforce_server"."<tmf_entity>" AS
SELECT
    t0."Id"::text AS "id",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/<api-path>/' || t0."Id")::text AS "href",
    -- ... field mappings ...
    '<EntityType>'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM "salesforce_server"."<CloudSense_Object>" t0;
```

### Complex Type Casting

For TMF composite types (arrays of objects), use explicit ROW constructors:

```sql
-- ExternalIdentifier array
ARRAY[
    ROW(
        NULL::text,                    -- owner
        'orderNumber'::text,           -- externalIdentifierType  
        t0."Order_Number__c"::text,    -- id
        'ExternalIdentifier'::text,    -- @type
        NULL::text,                    -- @baseType
        NULL::text                     -- @schemaLocation
    )::"tmf"."ExternalIdentifier"
]::"tmf"."ExternalIdentifier"[] AS "externalId"
```

---

## Local Development

### Starting the Runtime Locally

```bash
cd /Users/vladsorici/BSSMagic-RUNTIME

# Login to ECR
./docker-login.sh

# Start the runtime
docker compose up -d

# Check status
docker compose ps
```

### Local Endpoints

| Service | URL |
|---------|-----|
| TMF API | http://localhost:8000 |
| PostgreSQL | localhost:5432 |

### Connecting to Local PostgreSQL

```bash
docker exec -it bssmagic-runtime-bssmagic-runtime-1 psql -U admin
```

---

## Custom Schema Extension

To add custom fields or entities not in the standard TMF schema:

### 1. Extract Schema Files

```bash
docker run --rm --entrypoint /bin/bash \
  008731404932.dkr.ecr.us-east-1.amazonaws.com/prod/bssmagic-runtime:latest -c "
    cat /docker-entrypoint-initdb.d/tmf.sql > /tmp/tmf.sql && \
    unzip -q /tmf-server-0.0.1-SNAPSHOT.jar 'BOOT-INF/classes/types.json' -d /tmp && \
    tar -C /tmp -c tmf.sql BOOT-INF
  " | tar -x
```

### 2. Modify Schema

**tmf.sql** - Add PostgreSQL type definitions:
```sql
-- Add custom field to existing type
ALTER TYPE "tmf"."Service" ADD ATTRIBUTE "x_customField" text;
```

**types.json** - Add JSON schema for JsonbRowMapper:
```json
{
  "Service": {
    "x_customField": "string"
  }
}
```

### 3. Build Custom Image

```dockerfile
FROM 008731404932.dkr.ecr.us-east-1.amazonaws.com/prod/bssmagic-runtime:latest

COPY tmf.sql /docker-entrypoint-initdb.d/tmf.sql
COPY BOOT-INF /BOOT-INF
RUN jar uf /tmf-server-0.0.1-SNAPSHOT.jar BOOT-INF/*
RUN rm -rf /BOOT-INF
```

### 4. Deploy

```bash
# Build and push to ECR
docker build -t bssmagic-custom:latest ./custom-runtime
docker tag bssmagic-custom:latest 652413721990.dkr.ecr.ap-southeast-1.amazonaws.com/bssmagic-runtime:custom
docker push 652413721990.dkr.ecr.ap-southeast-1.amazonaws.com/bssmagic-runtime:custom

# Update ECS task definition
aws ecs update-service --cluster bssmagic-cluster --service bssmagic-service \
  --force-new-deployment --profile totogi-runtime --region ap-southeast-1
```

---

## Troubleshooting

### Common Errors

#### 1. "Error parsing JSONB: null"

**Cause**: Complex TMF types not properly cast in SQL view  
**Solution**: Use explicit `ROW()` constructors with correct type casting

```sql
-- Wrong
jsonb_build_object('id', t0."Id") AS "externalId"

-- Correct
ARRAY[ROW(...)::"tmf"."ExternalIdentifier"]::"tmf"."ExternalIdentifier"[] AS "externalId"
```

#### 2. "relation does not exist"

**Cause**: Salesforce object not in FDW  
**Solution**: Trigger auto-discovery or import manually

```sql
IMPORT FOREIGN SCHEMA salesforce 
LIMIT TO (missing_object__c) INTO salesforce_server;
```

#### 3. "cannot change name of view column"

**Cause**: Trying to use `CREATE OR REPLACE VIEW` when column order changed  
**Solution**: Drop and recreate the view

```sql
DROP VIEW IF EXISTS salesforce_server."entityName";
CREATE VIEW salesforce_server."entityName" AS ...
```

### Checking TMF Server Logs

```bash
# AWS Runtime
aws ecs execute-command --cluster bssmagic-cluster \
  --task <task-id> --container bssmagic-runtime \
  --interactive --command "/bin/bash" \
  --profile totogi-runtime --region ap-southeast-1

# Inside container
tail -f /var/log/tmf-server.log
```

---

## API Testing Examples

### List Services
```bash
curl "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/service?limit=5"
```

### Get Specific Service
```bash
curl "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/service/{id}"
```

### Check Mappings
```bash
curl "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/mappings"
```

### List Product Orders
```bash
curl "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productOrderingManagement/v5/productOrder"
```

---

## File Locations

| File | Purpose |
|------|---------|
| `/Users/vladsorici/BSSMagic-RUNTIME/docker-compose.yml` | Local runtime configuration |
| `/Users/vladsorici/BSSMagic-RUNTIME/config.json` | Runtime configuration |
| `/Users/vladsorici/BSSMagic-RUNTIME/custom-runtime/` | Custom schema extension files |
| `/Users/vladsorici/BSSMagic-RUNTIME/custom-runtime/tmf.sql` | PostgreSQL TMF type definitions |
| `/Users/vladsorici/BSSMagic-RUNTIME/custom-runtime/BOOT-INF/classes/types.json` | JSON schema for JsonbRowMapper |

---

## References

- [TM Forum Open APIs](https://www.tmforum.org/open-apis/)
- [PostgreSQL Foreign Data Wrappers](https://wiki.postgresql.org/wiki/Foreign_data_wrappers)
- [BSS Magic Documentation](https://docs.bssmagic.io/)










