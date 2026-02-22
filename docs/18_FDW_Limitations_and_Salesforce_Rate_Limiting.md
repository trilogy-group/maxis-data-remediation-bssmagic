# FDW Limitations and Salesforce Rate Limiting

> **Purpose:** Technical documentation explaining why complex JOINs in PostgreSQL views cause Salesforce FDW failures
> **Created:** January 12, 2026
> **Context:** Discovered while attempting to add `cscfga__Attribute__c` (7.5M records) to the `product` view

---

## Executive Summary

The Salesforce Foreign Data Wrapper (FDW) has inherent limitations when handling complex SQL views with multiple JOINs. Each JOIN in a view translates to separate SOQL queries and OAuth token requests to Salesforce, which can trigger rate limiting and cause "Data Not Available" errors.

**Key Finding:** Views with 7+ JOINs consistently fail due to Salesforce rate limiting.

---

## How the Salesforce FDW Works

### Query Translation Process

The PostgreSQL FDW for Salesforce **does NOT** execute complex JOINs on the Salesforce side. Instead:

1. **Each table in a JOIN = Separate SOQL query**
   - FDW sends a SOQL query to Salesforce for each table
   - Results are fetched back to PostgreSQL
   - PostgreSQL performs the JOIN locally

2. **Each SOQL query = OAuth token request**
   - Every query to Salesforce requires authentication
   - This means multiple OAuth token requests per API call

### Visual Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SINGLE TMF API REQUEST                            │
│                  GET /product?limit=1                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   PostgreSQL FDW                        Salesforce                       │
│   ─────────────                         ──────────                       │
│                                                                          │
│   1. OAuth Token ─────────────────────► Token Request #1                 │
│   2. SOQL: Solution ──────────────────► API Call #1 (282K potential)    │
│   3. OAuth Token ─────────────────────► Token Request #2                 │
│   4. SOQL: Subscription ──────────────► API Call #2 (142K potential)    │
│   5. OAuth Token ─────────────────────► Token Request #3                 │
│   6. SOQL: Service ───────────────────► API Call #3 (320K potential)    │
│   7. OAuth Token ─────────────────────► Token Request #4                 │
│   8. SOQL: Product Config ────────────► API Call #4 (618K potential)    │
│   9. OAuth Token ─────────────────────► Token Request #5                 │
│   10. SOQL: Product Def ──────────────► API Call #5 (340 records)       │
│   11. OAuth Token ────────────────────► Token Request #6                 │
│   12. SOQL: Account ──────────────────► API Call #6                      │
│   13. OAuth Token ────────────────────► Token Request #7                 │
│   14. SOQL: User ─────────────────────► API Call #7                      │
│                                                                          │
│   ═══════════════════════════════════════════════════════════════════   │
│   7 JOINs = 7 OAuth tokens + 7 SOQL queries per request                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The Query Explosion Problem

### Current Product View Structure

```
Solution (282K records)
    └── LEFT JOIN Account (for billingAccount)
    └── LEFT JOIN User (for relatedParty[creator])
    └── LEFT JOIN Subscription (142K - for product[])
    └── LEFT JOIN Service (320K - for realizingService[])
    └── LEFT JOIN Product Configuration (618K - for productOffering)
    └── LEFT JOIN Product Definition (340 - for productOffering name)
```

**Total: 6 JOINs** - This is at the limit of what works reliably.

### Failed Attribute Addition

When we attempted to add Attributes:

```
Solution (282K records)
    └── ... existing 6 JOINs ...
    └── LEFT JOIN Attribute (7.5M records!) ← THE PROBLEM
```

**Total: 7 JOINs + 7.5M record table** - Consistently triggers rate limiting.

---

## Failure Modes

### 1. OAuth Rate Limiting

Salesforce limits OAuth token requests per hour. With 7+ JOINs:
- 7+ rapid OAuth requests per single API call
- Multiple concurrent users = token exhaustion
- Result: `HTTP 500 "Data Not Available"` from OAuth endpoint

### 2. SOQL Query Limits

- Salesforce has daily/hourly API call limits
- Large result sets consume more API credits
- 7.5M Attribute records = massive API consumption

### 3. Result Set Size

Even with `LIMIT 1` on the final query:
- FDW must still fetch potential matches from all JOINed tables
- PostgreSQL tries to hold millions of rows in memory
- GROUP BY operations become extremely expensive

---

## The Error Message Decoded

```
HTTP Error 500 getting token from https://test.salesforce.com/services/oauth2/token

<div id="errorTitle">Data Not Available</div>
<div id="errorDesc">The data you were trying to access could not be found...</div>
```

This means:
- Salesforce's OAuth service is **refusing to issue new tokens**
- Not a data error - it's an **authentication throttling** response
- The sandbox is protecting itself from what looks like abuse

### Recovery Time

Once Salesforce rate-limits your OAuth tokens:
- The sandbox applies a cooling-off period
- Even simple queries fail because the OAuth endpoint is blocked
- Takes **~5-15 minutes** to recover

---

## Safe JOIN Limits

Based on our testing with the Maxis CloudSense sandbox:

| JOINs | Status | Notes |
|-------|--------|-------|
| 0-2 | ✅ Safe | Simple views work reliably |
| 3-4 | ⚠️ Marginal | Works but can hit limits under load |
| 5-6 | ⚠️ Risky | Current product view - works with delays |
| 7+ | ❌ Fails | Triggers rate limiting consistently |

### Record Count Thresholds

| Records in JOINed Table | Risk Level |
|-------------------------|------------|
| < 1,000 | ✅ Safe |
| 1,000 - 100,000 | ⚠️ Monitor |
| 100,000 - 1,000,000 | ⚠️ High Risk |
| > 1,000,000 | ❌ Avoid |

---

## Current View Statistics

| View | JOINs | Largest Table | Status |
|------|-------|---------------|--------|
| `individual` | 0 | Contact (direct) | ✅ Safe |
| `organization` | 0 | Account (direct) | ✅ Safe |
| `service` | 3 | Service + BA + Contact | ✅ Safe |
| `shoppingCart` | 2 | Basket + Config | ✅ Safe |
| `product` | 6 | Service (320K) | ⚠️ At Limit |
| `serviceProblem` | 0 | Direct table | ✅ Safe |

---

## Workarounds for Large Tables

### 1. Direct SOQL Queries

Use the CloudSense SOQL MCP tool for ad-hoc queries:

```sql
SELECT Id, Name, cscfga__Display_Value__c, cscfga__Is_Line_Item__c 
FROM cscfga__Attribute__c 
WHERE cscfga__Product_Configuration__r.csordtelcoa__Solution__c = 'a246D000000aKvJQAU'
AND cscfga__Hidden__c = false
AND cscfga__is_active__c = true
```

### 2. Filtered Sub-Views

Create separate views with WHERE clauses that pre-filter large tables:

```sql
-- Instead of joining all 7.5M Attributes
CREATE VIEW salesforce_server."solution_key_attributes" AS
SELECT ...
FROM cscfga__Attribute__c attr
WHERE attr."Name" IN ('RC', 'NRC', 'Status', 'Reserved Number', 'isMACD')
AND attr.cscfga__Product_Configuration__r.csordtelcoa__Solution__c IS NOT NULL;
```

### 3. Materialized Views (Future Enhancement)

Pre-aggregate data periodically:

```sql
CREATE MATERIALIZED VIEW solution_attribute_summary AS
SELECT 
    pc.csordtelcoa__Solution__c as solution_id,
    COUNT(*) as attribute_count,
    SUM(CASE WHEN attr.cscfga__Is_Line_Item__c THEN 1 ELSE 0 END) as line_item_count
FROM cscfga__Product_Configuration__c pc
JOIN cscfga__Attribute__c attr ON attr.cscfga__Product_Configuration__c = pc.Id
GROUP BY pc.csordtelcoa__Solution__c;
```

### 4. API-Level Aggregation

Add Attributes via a secondary API call in the application layer rather than SQL JOINs.

---

## Recommendations

1. **Keep JOINs under 6** for production views
2. **Never JOIN tables > 1M records** unless heavily filtered
3. **Use direct SOQL** for ad-hoc large-table queries
4. **Monitor Salesforce API limits** in Setup > Company Information > API Usage
5. **Implement caching** at the application layer for frequently accessed data
6. **Consider pre-aggregation** if large-table data is needed regularly

---

## Related Documentation

- `/docs/8_Custom_Schema_Extension_Guide.md` - Adding custom fields
- `/docs/17_CloudSense_TMF_Hierarchy_Mapping.md` - Object relationships
- `/.cursorrules` - Container deployment and view application procedures

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-12 | Claude (with Vlad) | Initial creation after Attribute JOIN failure |
