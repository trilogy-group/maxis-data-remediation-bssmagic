# FDW JOIN Performance Learnings

> **Purpose:** Technical documentation of JOIN performance issues discovered during MCBDIR-129
> **Created:** February 2, 2026
> **Context:** Discovered while attempting to add `x_parentBundleName` to the service view

---

## Executive Summary

When adding JOINs to TMF views, even with small result sets, the FDW may cause extreme slowdowns (60+ seconds) or API timeouts. This document captures learnings from MCBDIR-129 where adding a single LEFT JOIN caused complete API failures.

**Key Finding:** A single LEFT JOIN to `cscfga__Product_Configuration__c` (618K records) caused 60+ second query times, even when querying a single service by ID.

---

## The Problem: x_parentBundleName (MCBDIR-129)

### Requirement

Add a denormalized field `x_parentBundleName` to the service view to enable filtering by parent bundle name.

### Implementation Attempt

```sql
-- Added to service.sql
LEFT JOIN salesforce_server."cscfga__Product_Configuration__c" parent_pc
    ON parent_pc."Id" = svc."csordtelcoa__Parent_Product_Configuration__c"

-- With field:
parent_pc."Name"::text AS "x_parentBundleName"
```

### Result

- **Database query**: 60+ seconds timeout
- **API response**: 500 Internal Server Error
- **FDW behavior**: Full table scan of Product Configuration table

---

## Why JOINs Are Slow in FDW

### FDW Query Execution Pattern

The Salesforce FDW does NOT push JOIN predicates to Salesforce. Instead:

1. **Query 1**: Fetch all matching rows from `csord__Service__c` (with WHERE/LIMIT pushed)
2. **Query 2**: Fetch ALL rows from `cscfga__Product_Configuration__c` (NO filter pushed!)
3. **PostgreSQL**: Perform the JOIN locally

### Visual Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                 QUERY: SELECT * FROM service WHERE id = 'abc123'      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   FDW Execution:                                                      │
│                                                                       │
│   Step 1: Query csord__Service__c                                     │
│           SOQL: SELECT ... FROM csord__Service__c WHERE Id = 'abc123' │
│           Result: 1 row ✅                                             │
│                                                                       │
│   Step 2: Query cscfga__Product_Configuration__c                      │
│           SOQL: SELECT Id, Name FROM cscfga__Product_Configuration__c │
│           Result: 618,000 rows ❌ (FULL TABLE SCAN!)                   │
│                                                                       │
│   Step 3: PostgreSQL performs JOIN locally                            │
│           Matches 1 service with 1 config from 618K rows              │
│           Time: 60+ seconds                                           │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Insight

The FDW cannot push down the JOIN condition (`parent_pc.Id = svc.csordtelcoa__Parent_Product_Configuration__c`) to Salesforce. It must fetch ALL rows from the joined table and filter locally.

---

## Tables That Are Safe vs Dangerous to JOIN

### Safe Tables (< 10K records)

| Table | Approximate Records | Safe for JOIN |
|-------|---------------------|---------------|
| `Contact` (for individuals) | ~5K | ✅ Yes |
| `User` | ~500 | ✅ Yes |
| `cscfga__Product_Definition__c` | ~340 | ✅ Yes |
| `csord__Order__c` | ~10K | ⚠️ Marginal |

### Dangerous Tables (> 100K records)

| Table | Approximate Records | Safe for JOIN |
|-------|---------------------|---------------|
| `csord__Service__c` | ~320K | ❌ No |
| `cscfga__Product_Configuration__c` | ~618K | ❌ No |
| `cscfga__Attribute__c` | ~7.5M | ❌ Never |
| `csord__Subscription__c` | ~142K | ❌ No |
| `csordtelcoa__Solution__c` | ~282K | ❌ No |

---

## Workarounds

### Option 1: Direct ID Field Only (No Name Resolution)

Instead of the name, expose just the ID and let the client resolve it:

```sql
-- Fast: Direct reference, no JOIN
svc."csordtelcoa__Parent_Product_Configuration__c"::text AS "x_parentBundleId"
```

**Pros:** Fast, pushes to Salesforce
**Cons:** Client needs second API call for name

### Option 2: Formula Field in Salesforce

If a formula field exists on Service that contains the parent name:

```sql
-- Fast if formula field exists
svc."Parent_Bundle_Name__c"::text AS "x_parentBundleName"
```

**Pros:** Fast, single source of truth
**Cons:** Requires Salesforce admin to create formula field

### Option 3: Subquery with LATERAL JOIN

Use a correlated subquery that might push down better:

```sql
-- May be faster depending on FDW version
SELECT 
    svc.*,
    (SELECT pc."Name" 
     FROM salesforce_server."cscfga__Product_Configuration__c" pc 
     WHERE pc."Id" = svc."csordtelcoa__Parent_Product_Configuration__c"
     LIMIT 1) AS "x_parentBundleName"
FROM salesforce_server."csord__Service__c" svc;
```

**Pros:** Might push down better
**Cons:** N+1 query problem, untested

### Option 4: Materialized View with Periodic Refresh

Pre-compute the mapping:

```sql
CREATE MATERIALIZED VIEW service_bundle_names AS
SELECT 
    svc."Id" AS service_id,
    pc."Name" AS parent_bundle_name
FROM salesforce_server."csord__Service__c" svc
LEFT JOIN salesforce_server."cscfga__Product_Configuration__c" pc
    ON pc."Id" = svc."csordtelcoa__Parent_Product_Configuration__c"
WHERE svc."csordtelcoa__Parent_Product_Configuration__c" IS NOT NULL;

-- Refresh periodically
REFRESH MATERIALIZED VIEW service_bundle_names;
```

**Pros:** Fast queries after materialization
**Cons:** Stale data, requires refresh scheduling, ephemeral in ECS

### Option 5: Application-Level Resolution

Fetch the name in the application layer:

```typescript
// In dashboard/API client
const service = await fetchService(id);
if (service.x_parentBundleId) {
    const productConfig = await fetchProductConfiguration(service.x_parentBundleId);
    service.x_parentBundleName = productConfig.name;
}
```

**Pros:** No SQL changes needed
**Cons:** More API calls, client complexity

---

## Recommendations for MCBDIR-129

Given the constraints, we recommend:

1. **Immediate**: Revert to service_0join.sql (no parent bundle name)
2. **Short-term**: Add `x_parentBundleId` as a direct field (fast)
3. **Long-term**: Request Salesforce admin to add formula field on Service

### Proposed Implementation

```sql
-- Add to service.sql (FAST - direct field reference)
svc."csordtelcoa__Parent_Product_Configuration__c"::text AS "x_parentBundleId"
```

This provides the ID for filtering, which is the core use case. The name can be resolved client-side when displaying in the UI.

---

## Testing JOIN Performance

Before adding any JOIN to a view, test the query time:

```sql
-- Test in PostgreSQL on the container
\timing on

-- Test the JOIN query
SELECT COUNT(*) FROM (
    SELECT svc."Id", joined_table."Name"
    FROM salesforce_server."csord__Service__c" svc
    LEFT JOIN salesforce_server."target_table" joined_table
        ON joined_table."Id" = svc."join_field"
    LIMIT 1
) subq;
```

If the query takes > 5 seconds for LIMIT 1, the JOIN is too expensive.

---

## Related Documentation

- `/docs/18_FDW_Limitations_and_Salesforce_Rate_Limiting.md` - General FDW limitations
- `/docs/8_Custom_Schema_Extension_Guide.md` - Adding custom x_* fields
- `/.cursorrules` - View deployment procedures

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-02 | Claude (with Vlad) | Initial creation during MCBDIR-129 investigation |
