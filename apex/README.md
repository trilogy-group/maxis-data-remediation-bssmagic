# 1867 OE Auto-Patch Apex Scripts

**Purpose:** Automatically patch missing OE (Order Enrichment) fields in migrated CloudSense services

---

## Quick Start

### 1. Identify Services to Patch

Use TMF Service API:
```bash
curl -H "X-API-Key: bssmagic-d58d6761265b01accc13e8b21bae8282" \
  "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/service?limit=300&x_serviceType=Voice&x_migratedData=true"
```

Or use the TypeScript app at http://localhost:3000 (1867 OE Patcher module)

### 2. Update Script with Service IDs

Edit `/apex/Patch1867_Auto.apex` line 23:
```apex
Set<Id> serviceIds = new Set<Id>{
    'a236D000000eq04QAA',
    'a236D000000ek9PQAQ'
};
```

### 3. Execute in Salesforce

1. Open Salesforce Developer Console
2. Click **Debug** → **Execute Anonymous Window**
3. Paste the entire script
4. Check **Open Log** option
5. Click **Execute**

### 4. Check Results

Look for success messages in debug log:
```
✅ SUCCESS: Solution a246D000000d9gVQAQ updated
=== PATCH COMPLETE ===
Total services processed: 2
Total solutions updated: 1
```

---

## Files

| File | Purpose |
|------|---------|
| **`Patch1867_Auto.apex`** | Main auto-patch script (use this!) |
| `Patch1867_Comparison.md` | Old vs new approach comparison |
| `README.md` | This file |

---

## What Gets Auto-Patched

### Voice Services
| OE Field | Source | Status |
|----------|--------|--------|
| ReservedNumber | `External_ID__c` | ✅ Auto-patched |
| PICEmail | `Billing_Account__r.Contact__r.Email` | ✅ Auto-patched |
| ResourceSystemGroupID | ❓ Unknown | ⚠️ Manual |
| NumberStatus | ❓ Unknown | ⚠️ Manual |

### Fibre Services
| OE Field | Source | Status |
|----------|--------|--------|
| BillingAccount | `Billing_Account__c` | ✅ Auto-patched |

### eSMS Services
| OE Field | Source | Status |
|----------|--------|--------|
| ReservedNumber | `External_ID__c` | ✅ Auto-patched |
| eSMSUserName | `Billing_Account__r.Contact__r.Email` | ✅ Auto-patched (verify with Ashish) |

### Access Services
| OE Field | Source | Status |
|----------|--------|--------|
| BillingAccount | `Billing_Account__c` | ✅ Auto-patched |
| PICEmail | `Billing_Account__r.Contact__r.Email` | ✅ Auto-patched |

---

## Governor Limits

**Safe batch size:** 50 services per execution

| Resource | Limit | Usage per 50 Services |
|----------|-------|----------------------|
| SOQL Queries | 100 | 2 (Service + Attachment) |
| Callouts | 100 | ~10 (1 per solution) |
| CPU Time | 10,000ms | ~5,000ms |
| Heap Size | 6 MB | ~2 MB |

**For 454 services:** Run 10 batches of ~50 services each

---

## Error Handling

### Missing Billing Account
```
⚠️ Cannot patch PICEmail/BillingAccount - Billing_Account__c is NULL
```
**Fix:** Update Billing_Account__c field in Salesforce, then re-run

### Missing Contact
```
⚠️ Cannot patch PICEmail - Contact__c is NULL on Billing Account
```
**Fix:** Link Contact to Billing Account, or use Authorized_PIC_Email__c

### CloudSense API Error
```
❌ ERROR updating solution: Unauthorized
```
**Fix:** Check CloudSense API permissions for current user

---

## Testing Strategy

### Phase 1: Single Service Test
```apex
Set<Id> serviceIds = new Set<Id>{'a236D000000eq04QAA'};
```
Run script, verify success in logs.

### Phase 2: Small Batch (5-10 services)
```apex
Set<Id> serviceIds = new Set<Id>{
    'a236D000000eq04QAA',
    'a236D000000ek9PQAQ',
    'a236D000000ejgQQAQ'
    // ... 2-7 more
};
```
Verify all succeed, check CloudSense UI.

### Phase 3: Full Batch (50 services)
Run 10 times to cover all 454 services.

---

## Verification

### Using 1147-Gateway
```bash
# Before patch
curl http://localhost:8080/api/1867/service/{serviceId}/attachment
# Check analysis.missingFields

# After patch
curl http://localhost:8080/api/1867/service/{serviceId}/attachment
# missingFields should be reduced
```

### Using CloudSense UI
1. Open Service record
2. Navigate to Configuration tab
3. Click "View OE Attributes"
4. Verify patched fields are present

---

## Related Documentation

- **Workflow:** `/docs/1867_Auto_Patch_Workflow.md`
- **Field Mappings:** `/docs/1867_Detection_SOQL_Queries.md`
- **Gateway API:** `/1147-gateway/README.md`

---

## Open Questions for Ashish

1. **ResourceSystemGroupID** (Voice) - What is the Salesforce source field?
2. **NumberStatus** (Voice) - What is the Salesforce source field? Can we default to 'Active'?
3. **eSMSUserName** (eSMS) - Confirm `Billing_Account__r.Contact__r.Email` is correct

Once these are answered, Voice services can be 100% auto-patched!

---

**Status:** Ready for Testing  
**Best Candidates:** Fibre Service (233 services, 100% auto-patchable)
