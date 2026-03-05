# API 3 Response Capture: FDW Limitation Analysis

## Problem Statement

API 3 (`PUT /iot-qbs-orders/{orchestrationProcessId}/services`) returns a rich response with per-service patch results:

```json
{
  "success": true,
  "results": [
    { "serviceId": "a1Sxx00000SVC001", "status": "UPDATED", "message": "Service updated successfully" },
    { "serviceId": "a1Sxx00000SVC002", "status": "FAILED",  "message": "FIELD_INTEGRITY_EXCEPTION: Billing Account not found" }
  ],
  "updatedCount": 1,
  "failedCount": 1
}
```

HTTP 207 (Multi-Status) is also possible when some services succeed and others fail. This per-service granularity is important for:

1. **Partial failure diagnosis** -- knowing *which* service failed and *why*
2. **Retry logic** -- retrying only the failed services, not the entire batch
3. **Audit trail** -- recording exactly what happened per service in the ServiceProblem
4. **Dashboard visibility** -- showing operators which services need manual intervention

The REST FDW cannot return this response data through the current architecture.

## Root Cause: FDW `update()` Discards Response Body

The REST FDW's `update()` method sends the HTTP request and checks the status code, but does not return the response body back to PostgreSQL:

```python
# From runtime/fdw/rest/src/fdw_rest/rest_fdw.py (simplified)
def update(self, rowid, newvalues):
    path = self.byid_path.replace(f"{{{self.id_column}}}", str(rowid))
    url = f"{self.base_url}{path}"
    json_values = self._prepare_values_for_json(newvalues)
    response = self._make_request(url, method=self.update_method, json=json_values)
    # response.raise_for_status() -- throws on 4xx/5xx
    # BUT: response body is never returned to PostgreSQL
```

In PostgreSQL, `UPDATE` is a DML statement that modifies rows but does not return data to the calling context (trigger). The Multicorn FDW framework's `update()` returns `None` -- the response JSON from Salesforce is received by the FDW Python process but has no path back to the PL/pgSQL trigger.

This is not a bug -- it's a fundamental limitation of how PostgreSQL FDW write operations work.

## How This Affects IoT QBS

The INSTEAD OF INSERT trigger for API 3 follows the established pattern (same as `oeServiceAttachment` and `solutionPostUpdate`):

```sql
CREATE FUNCTION salesforce_server._fn_iotQbsServicePatch_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- This UPDATE sends PUT to Salesforce and gets the response...
    UPDATE salesforce_server."_ft_iotQbsServicePatch"
    SET "services" = NEW."services"::JSONB
    WHERE "orchestrationProcessId" = NEW."orchestrationProcessId";

    -- ...but we have no way to read what Salesforce returned.
    -- We can only infer: if UPDATE didn't throw, it was HTTP 2xx.
    NEW."success" := 'true';
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    NEW."success" := 'false';
    NEW."results" := SQLERRM;  -- PostgreSQL error message, not Salesforce response
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### What We Lose

| Information | Available? | Impact |
|-------------|-----------|--------|
| Overall success/failure | Yes (exception = failure) | Low -- revalidation catches this |
| HTTP status code (200 vs 207) | Partial (5xx = exception, 207 = unclear) | Medium -- can't distinguish full success from partial |
| Per-service status (UPDATED/FAILED) | **No** | **High** -- can't identify which services failed |
| Per-service error message | **No** | **High** -- can't diagnose field-level issues |
| `updatedCount` / `failedCount` | **No** | Medium -- useful for logging and dashboard |
| Partial failure details | **No** | **High** -- can't retry only failed services |

### Concrete Scenario Where This Matters

Order with 10 services, 5 need patching. API 3 is called once per target PC:

**With response capture:**
```
PATCH PC-A: 3/3 UPDATED ✓
PATCH PC-B: 1/2 UPDATED, 1 FAILED (Billing_Account__c: "FIELD_INTEGRITY_EXCEPTION")
→ BSS Magic retries SVC-007 with corrected Billing_Account__c
→ Or: flags SVC-007 for manual intervention, releases the other 9
```

**Without response capture (current design):**
```
PATCH PC-A: success='true' (no details)
PATCH PC-B: success='true' (no details -- HTTP 207 doesn't throw exception)
→ Revalidation: SVC-007 still has wrong PC linkage
→ BSS Magic knows SOMETHING failed but not WHY
→ State -> FAILED, entire orchestration stays on hold
→ Operator must manually investigate
```

The key gap: **HTTP 207 (partial success) does not raise an exception** in the FDW, so the trigger reports success even though some services failed. The revalidation step catches the remaining mismatches but provides no diagnostic information about the root cause.

## Option 2: Solutions to Capture the Response

### 2a. Modify the REST FDW to Return Response Data

Add a `RETURNING`-like mechanism to the FDW's `update()`:

```python
def update(self, rowid, newvalues):
    ...
    response = self._make_request(url, method=self.update_method, json=json_values)
    # NEW: Store response in a session-level variable or temp table
    self._last_response = response.json()
    # NEW: Return response columns mapped back to the foreign table
    return self._map_response_to_columns(self._last_response)
```

**Pros:**
- Clean, reusable solution for all modules
- No API changes needed

**Cons:**
- Requires modifying the FDW source code (separate repo: `trilogy-group/totogi-bss-magic-ontology`)
- Multicorn's `update()` API may not support returning data (needs investigation)
- Risk of breaking existing foreign tables
- Deployment requires rebuilding the runtime Docker image

### 2b. Two-Step Trigger: Write + Read-Back

Add a second foreign table that reads the response after the write:

```sql
-- Step 1: Write (existing)
UPDATE salesforce_server."_ft_iotQbsServicePatch"
SET "services" = NEW."services"::JSONB
WHERE "orchestrationProcessId" = NEW."orchestrationProcessId";

-- Step 2: Read-back (hypothetical)
SELECT "success", "results", "updatedCount", "failedCount"
INTO NEW."success", NEW."results", NEW."updatedCount", NEW."failedCount"
FROM salesforce_server."_ft_iotQbsServicePatchResult"
WHERE "orchestrationProcessId" = NEW."orchestrationProcessId";
```

**Blocker:** This requires a separate Salesforce endpoint that returns the last patch result for a given orchestration. No such endpoint exists in the current API spec. The Apex API returns results inline with the PUT response -- there is no way to retrieve them after the fact.

**Would require:** Ashish to add a new endpoint:
```
GET /iot-qbs-orders/{orchestrationProcessId}/services/last-result
```

### 2c. Bypass FDW for API 3 Only (Hybrid)

Use the REST FDW for APIs 1, 2, 4 but call API 3 directly from the batch orchestrator via httpx:

```python
# In tmf_client.py or a dedicated sf_client
def iot_qbs_patch_services(self, orch_id, services_payload):
    resp = httpx.put(
        f"{self.sf_instance_url}/services/apexrest/api/v1/iot-qbs-orders/{orch_id}/services",
        headers={"Authorization": f"Bearer {self.sf_token}"},
        json={"services": services_payload},
    )
    return resp.json()  # Full response including results[], updatedCount, failedCount
```

**Pros:**
- Full response capture with zero FDW changes
- Only affects one API call
- Already proven in smoke tests

**Cons:**
- Breaks architectural consistency (3 APIs via FDW, 1 direct)
- Requires separate OAuth token management in the batch orchestrator
- Two authentication paths to maintain

### 2d. Store Response in PostgreSQL Temp Table via FDW Extension

Extend the FDW with a `response_table` option that writes the full response to a temp table:

```sql
CREATE FOREIGN TABLE "_ft_iotQbsServicePatch" (
    ...
) SERVER rest_server
OPTIONS (
    ...
    response_table 'salesforce_server._iot_qbs_last_response'  -- NEW option
);
```

The FDW's `update()` would write the full response JSON to this table, which the trigger then reads.

**Pros:**
- Reusable pattern
- No API changes

**Cons:**
- Requires FDW modification (same as 2a)
- Temp table concurrency issues if multiple patches run in parallel

## Option 1: Optimistic + Exception + Revalidation (Recommended)

Accept the FDW limitation and rely on the revalidation step as the definitive check:

```
PATCH -> assume success unless exception
REVALIDATE (API 1 reload) -> compare all services against truth table
  If all correct -> RELEASE
  If still wrong -> FAILED (with details about WHICH services are still wrong)
```

### What We Retain

- **Binary success/failure**: Exception = FDW/HTTP error (covers 4xx, 5xx)
- **Post-patch verification**: Revalidation tells us exactly which services are still wrong
- **Diagnostic information**: The revalidation findings include serviceId, SIM, currentPc, correctPc
- **Architectural consistency**: Same pattern as modules 1147 and 1867

### What We Lose

- **Root cause of per-service failures**: We know a service is still wrong but not *why* the patch failed (e.g., field integrity exception, permission error)
- **HTTP 207 awareness**: Partial success is indistinguishable from full success at the trigger level
- **Retry precision**: Can't retry only failed services with corrected values -- must decide to retry all or fail
- **Real-time patch progress**: Dashboard can't show "3/5 services patched, 2 failed" -- only "patching..." then "revalidating..."
- **Audit granularity**: ServiceProblem can record "5 mismatches found, patching failed for 2" but not the specific Salesforce error messages

### Risk Assessment

| Scenario | Likelihood | Impact with Option 1 |
|----------|-----------|---------------------|
| All services patch successfully | High (happy path) | No difference -- revalidation confirms |
| One service fails due to field error | Low-Medium | Revalidation catches it; operator investigates manually |
| HTTP 207 partial success | Low | Appears as success, revalidation catches remaining issues |
| Network timeout during PUT | Low | FDW exception caught, state -> FAILED, can retry |
| All services fail (bad payload) | Very Low | FDW exception if 500, or revalidation catches all still wrong |

The highest-impact gap is the HTTP 207 scenario: the trigger reports success, but 1-2 services actually failed. The revalidation step catches this ~30 seconds later when it reloads all services via API 1 and compares against the truth table. The orchestration stays on hold (state -> FAILED) with findings showing which services are still mismatched.

## Recommendation

**Go with Option 1 for initial implementation.** The revalidation step provides a reliable safety net. If operational experience shows that per-service error diagnostics are needed (e.g., repeated partial failures that are hard to debug), pursue Option 2a (FDW modification) as a separate work item.

## Summary

| Aspect | Option 1 (Recommended) | Option 2a (FDW mod) | Option 2b (New endpoint) | Option 2c (Hybrid) |
|--------|----------------------|--------------------|-----------------------|-------------------|
| FDW changes | None | Yes (risk) | None | None |
| API changes | None | None | Yes (Ashish) | None |
| Architecture consistency | Full FDW | Full FDW | Full FDW | Partial (3+1) |
| Per-service results | No | Yes | Yes | Yes |
| Implementation effort | Low | High | Medium | Medium |
| Revalidation catches issues | Yes | N/A | N/A | N/A |
