# TMF Entity Mappings - Complete Reference

**Last Updated**: December 16, 2025  
**Runtime**: BSS Magic AWS (ap-southeast-1)

---

## Overview

This document details all TMF entity mappings from CloudSense Salesforce objects to TM Forum standard APIs.

---

## Mapping Summary

| TMF Entity | TMF API | CloudSense Object | Status |
|------------|---------|-------------------|--------|
| Service | TMF638 | `csord__Service__c` | ✅ Working |
| Individual | TMF632 | `Contact` | ✅ Working |
| Organization | TMF632 | `Account` | ✅ Working |
| ProductOrder | TMF622 | `csord__Order__c` | ✅ Working |
| PartyAccount | TMF666 | `Account` | ✅ Working |
| BillingAccount | TMF666 | `Account` | ✅ Working |
| Product | TMF637 | `csord__Subscription__c` | ⚠️ Partial |
| ShoppingCart | TMF663 | `cscfga__Product_Basket__c` | ⏳ Pending |
| TaskFlow | TMF653 | `CSPOFA__Orchestration_Process__c` | ⏳ Pending |
| Task | TMF653 | `CSPOFA__Orchestration_Step__c` | ⏳ Pending |

---

## 1. Service (TMF638)

**CloudSense Object**: `csord__Service__c`  
**API Endpoint**: `/tmf-api/serviceInventoryManagement/v5/service`  
**Status**: ✅ Working

### Field Mappings

| TMF Field | CloudSense Field | Type | Notes |
|-----------|------------------|------|-------|
| `id` | `Id` | text | Salesforce ID |
| `href` | Generated | text | Full API URL |
| `name` | `Name` | text | Service name |
| `state` | `csord__Status__c` | ServiceStateType | Mapped enum |
| `startDate` | `csord__Start_Date__c` | timestamp | Service start |
| `endDate` | `csord__End_Date__c` | timestamp | Service end |
| `serviceCharacteristic` | Various | Characteristic[] | ICCID, MSISDN, APN |
| `@type` | Static | text | "Service" |

### State Mapping

| CloudSense Status | TMF State |
|-------------------|-----------|
| Service Created | `feasibilityChecked` |
| Active | `active` |
| Suspended | `suspended` |
| Terminated | `terminated` |
| Cancelled | `inactive` |

### Example Response

```json
{
  "id": "a1CMS0000008sXY2AY",
  "href": "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/service/a1CMS0000008sXY2AY",
  "name": "IoT Service - SIM001",
  "state": "active",
  "startDate": "2024-01-15T00:00:00Z",
  "@type": "Service"
}
```

---

## 2. Individual (TMF632)

**CloudSense Object**: `Contact`  
**API Endpoint**: `/tmf-api/partyManagement/v5/individual`  
**Status**: ✅ Working

### Field Mappings

| TMF Field | CloudSense Field | Type | Notes |
|-----------|------------------|------|-------|
| `id` | `Id` | text | Salesforce ID |
| `href` | Generated | text | Full API URL |
| `givenName` | `FirstName` | text | First name |
| `familyName` | `LastName` | text | Last name |
| `formattedName` | `FirstName + ' ' + LastName` | text | Full name |
| `title` | `Salutation` | text | Mr/Mrs/etc |
| `birthDate` | `Birthdate` | date | Date of birth |
| `gender` | `Contact_Gender__c` | text | Gender |
| `status` | `Contact_Status__c` | text | Contact status |
| `contactMedium` | Email, Phone, Mobile | ContactMedium[] | Contact details |
| `createdDate` | `CreatedDate` | timestamp | Creation date |
| `lastUpdate` | `LastModifiedDate` | timestamp | Last modified |
| `@type` | Static | text | "Individual" |

### SQL View

```sql
CREATE OR REPLACE VIEW "salesforce_server"."individual" AS
SELECT
    t0."Id"::text AS "id",
    'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/individual/' || t0."Id"::text AS "href",
    t0."FirstName"::text AS "givenName",
    t0."LastName"::text AS "familyName",
    COALESCE(t0."FirstName"::text || ' ', '') || COALESCE(t0."LastName"::text, '') AS "formattedName",
    t0."Salutation"::text AS "title",
    t0."Birthdate"::date AS "birthDate",
    t0."Contact_Gender__c"::text AS "gender",
    t0."Contact_Status__c"::text AS "status",
    t0."CreatedDate"::timestamp with time zone AS "createdDate",
    t0."LastModifiedDate"::timestamp with time zone AS "lastUpdate",
    'Individual'::text AS "@type",
    'Party'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM "salesforce_server"."Contact" t0
WHERE t0."IsDeleted" = false;
```

---

## 3. ProductOrder (TMF622)

**CloudSense Object**: `csord__Order__c`  
**API Endpoint**: `/tmf-api/productOrderingManagement/v5/productOrder`  
**Status**: ✅ Working

### Field Mappings

| TMF Field | CloudSense Field | Type | Notes |
|-----------|------------------|------|-------|
| `id` | `Id` | text | Salesforce ID |
| `href` | Generated | text | Full API URL |
| `externalId` | `csord__Order_Number__c`, `Name` | ExternalIdentifier[] | Order identifiers |
| `state` | `csord__Status2__c` | ProductOrderStateType | Mapped enum |
| `category` | `csord__Order_Type__c` | text | Order type |
| `relatedParty` | Account join | RelatedPartyRefOrPartyRoleRef[] | Customer reference |
| `requestedStartDate` | `csord__Start_Date__c` | timestamp | Requested start |
| `requestedCompletionDate` | `csord__End_Date__c` | timestamp | Requested completion |
| `completionDate` | `Order_Completed_Date__c` | timestamp | Actual completion |
| `creationDate` | `CreatedDate` | timestamp | Order creation |
| `@type` | Static | text | "ProductOrder" |

### State Mapping

| CloudSense Status | TMF State |
|-------------------|-----------|
| Draft | `draft` |
| Submitted | `acknowledged` |
| Order Submitted | `acknowledged` |
| In Progress | `inProgress` |
| Completed | `completed` |
| Cancelled | `cancelled` |
| Failed | `failed` |
| (default) | `pending` |

### SQL View

```sql
DROP VIEW IF EXISTS salesforce_server."productOrder";
CREATE VIEW salesforce_server."productOrder" AS
SELECT
    t0."Id"::text AS id,
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productOrderingManagement/v5/productOrder/' || t0."Id")::text AS href,
    
    -- externalId as array of ExternalIdentifier
    ARRAY[
        ROW(
            NULL::text,                                    -- owner
            'orderNumber'::text,                          -- externalIdentifierType  
            COALESCE(t0."csord__Order_Number__c", t0."Name")::text,  -- id
            'ExternalIdentifier'::text,                   -- @type
            NULL::text,                                   -- @baseType
            NULL::text                                    -- @schemaLocation
        )::"tmf"."ExternalIdentifier"
    ]::"tmf"."ExternalIdentifier"[] AS "externalId",
    
    -- state
    CASE 
        WHEN t0."csord__Status2__c" = 'Draft' THEN 'draft'::"tmf"."ProductOrderStateType" 
        WHEN t0."csord__Status2__c" = 'Submitted' THEN 'acknowledged'::"tmf"."ProductOrderStateType" 
        WHEN t0."csord__Status2__c" = 'In Progress' THEN 'inProgress'::"tmf"."ProductOrderStateType" 
        WHEN t0."csord__Status2__c" = 'Completed' THEN 'completed'::"tmf"."ProductOrderStateType" 
        WHEN t0."csord__Status2__c" = 'Cancelled' THEN 'cancelled'::"tmf"."ProductOrderStateType"
        WHEN t0."csord__Status2__c" = 'Failed' THEN 'failed'::"tmf"."ProductOrderStateType"
        WHEN t0."csord__Status2__c" = 'Order Submitted' THEN 'acknowledged'::"tmf"."ProductOrderStateType"
        ELSE 'pending'::"tmf"."ProductOrderStateType" 
    END AS state,
    
    COALESCE(t0."csord__Order_Type__c", 'standard')::text AS category,
    
    -- relatedParty as array of RelatedPartyRefOrPartyRoleRef
    CASE WHEN t1."Id" IS NOT NULL THEN
        ARRAY[
            ROW(
                'customer'::text,                           -- role
                ROW(
                    ROW(
                        t1."Id"::text,                          -- PartyRef.id
                        ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/organization/' || t1."Id")::text,
                        t1."Name"::text,                        -- PartyRef.name
                        'Organization'::text,                   -- PartyRef.@referredType
                        'PartyRef'::text,                       -- PartyRef.@type
                        NULL::text,                             -- PartyRef.@baseType
                        NULL::text                              -- PartyRef.@schemaLocation
                    )::"tmf"."PartyRef",
                    NULL::"tmf"."PartyRoleRef"
                )::"tmf"."OneOfPartyRefOrPartyRoleRef",
                'RelatedPartyRefOrPartyRoleRef'::text,      -- @type
                NULL::text,                                 -- @baseType
                NULL::text                                  -- @schemaLocation
            )::"tmf"."RelatedPartyRefOrPartyRoleRef"
        ]::"tmf"."RelatedPartyRefOrPartyRoleRef"[]
    ELSE NULL::"tmf"."RelatedPartyRefOrPartyRoleRef"[]
    END AS "relatedParty",
    
    t0."csord__Start_Date__c"::timestamp(0) with time zone AS "requestedStartDate",
    t0."csord__End_Date__c"::timestamp(0) with time zone AS "requestedCompletionDate",
    t0."Order_Completed_Date__c"::timestamp(0) with time zone AS "completionDate",
    t0."CreatedDate"::timestamp(0) with time zone AS "creationDate",
    
    'ProductOrder'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM salesforce_server."csord__Order__c" t0
LEFT JOIN salesforce_server."Account" t1 ON t0."csord__Account__c" = t1."Id";
```

### Example Response

```json
{
  "id": "a1GMS0000005abc",
  "href": "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productOrderingManagement/v5/productOrder/a1GMS0000005abc",
  "externalId": [
    {
      "id": "ORD-2024-001234",
      "externalIdentifierType": "orderNumber",
      "@type": "ExternalIdentifier"
    }
  ],
  "state": "inProgress",
  "category": "New",
  "relatedParty": [
    {
      "role": "customer",
      "party": {
        "id": "001MS000001xyz",
        "name": "Acme Corp",
        "@referredType": "Organization"
      },
      "@type": "RelatedPartyRefOrPartyRoleRef"
    }
  ],
  "creationDate": "2024-12-10T10:30:00Z",
  "@type": "ProductOrder"
}
```

---

## 4. TaskFlow (TMF653) - PENDING

**CloudSense Object**: `CSPOFA__Orchestration_Process__c`  
**API Endpoint**: `/tmf-api/serviceFulfillment/v5/taskFlow`  
**Status**: ⏳ Pending (requires design-time registration)

### Proposed Field Mappings

| TMF Field | CloudSense Field | Type |
|-----------|------------------|------|
| `id` | `Id` | text |
| `href` | Generated | text |
| `name` | `Name` | text |
| `state` | `CSPOFA__Status__c` | TaskFlowStateType |
| `priority` | `CSPOFA__Priority__c` | integer |
| `progressPercentage` | `CSPOFA__Progress__c` | number |
| `relatedEntity` | Order__c, Solution__c | RelatedEntity[] |
| `creationDate` | `CreatedDate` | timestamp |
| `@type` | Static | text |

### State Mapping

| CloudSense Status | TMF State |
|-------------------|-----------|
| Pending | `pending` |
| In Progress | `inProgress` |
| Complete | `done` |
| Failed | `terminatedWithError` |
| On Hold | `held` |
| Cancelled | `cancelled` |

### Proposed SQL View

```sql
CREATE VIEW salesforce_server."taskFlow" AS
SELECT
    t0."Id"::text AS id,
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceFulfillment/v5/taskFlow/' || t0."Id")::text AS href,
    t0."Name"::text AS name,
    CASE 
        WHEN t0."CSPOFA__Status__c" = 'Pending' THEN 'pending'
        WHEN t0."CSPOFA__Status__c" = 'In Progress' THEN 'inProgress'
        WHEN t0."CSPOFA__Status__c" = 'Complete' THEN 'done'
        WHEN t0."CSPOFA__Status__c" = 'Failed' THEN 'terminatedWithError'
        WHEN t0."CSPOFA__Process_On_Hold__c" = true THEN 'held'
        WHEN t0."CSPOFA__Status__c" = 'Cancelled' THEN 'cancelled'
        ELSE 'pending'
    END AS state,
    t0."CSPOFA__Priority__c"::integer AS priority,
    t0."CSPOFA__Progress__c"::text AS "progressPercentage",
    t0."CreatedDate"::timestamp with time zone AS "creationDate",
    'TaskFlow'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM salesforce_server."CSPOFA__Orchestration_Process__c" t0;
```

---

## 5. Task (TMF653) - PENDING

**CloudSense Object**: `CSPOFA__Orchestration_Step__c`  
**API Endpoint**: `/tmf-api/serviceFulfillment/v5/task`  
**Status**: ⏳ Pending (requires design-time registration)

### Proposed Field Mappings

| TMF Field | CloudSense Field | Type |
|-----------|------------------|------|
| `id` | `Id` | text |
| `href` | Generated | text |
| `name` | `Name` | text |
| `state` | `CSPOFA__Status__c` | TaskStateType |
| `order` | `CSPOFA__Step_Order__c` | integer |
| `statusChangeReason` | `CSPOFA__Message__c` | text |
| `taskFlow` | `CSPOFA__Orchestration_Process__c` | TaskFlowRef |
| `@type` | Static | text |

### State Mapping

| CloudSense Status | TMF Task State |
|-------------------|----------------|
| Pending | `pending` |
| In Progress | `inProgress` |
| Complete | `done` |
| Failed | `terminatedWithError` |
| Error | `terminatedWithError` |
| Blocked | `held` |
| Skipped | `cancelled` |

---

## Complex Type Patterns

### ExternalIdentifier Array

```sql
ARRAY[
    ROW(
        NULL::text,              -- owner
        'orderNumber'::text,     -- externalIdentifierType  
        'ORD-001'::text,         -- id
        'ExternalIdentifier'::text,
        NULL::text,
        NULL::text
    )::"tmf"."ExternalIdentifier"
]::"tmf"."ExternalIdentifier"[] AS "externalId"
```

### RelatedPartyRefOrPartyRoleRef Array

```sql
ARRAY[
    ROW(
        'customer'::text,        -- role
        ROW(
            ROW(
                'account_id'::text,
                'http://...href...'::text,
                'Account Name'::text,
                'Organization'::text,
                'PartyRef'::text,
                NULL::text,
                NULL::text
            )::"tmf"."PartyRef",
            NULL::"tmf"."PartyRoleRef"
        )::"tmf"."OneOfPartyRefOrPartyRoleRef",
        'RelatedPartyRefOrPartyRoleRef'::text,
        NULL::text,
        NULL::text
    )::"tmf"."RelatedPartyRefOrPartyRoleRef"
]::"tmf"."RelatedPartyRefOrPartyRoleRef"[] AS "relatedParty"
```

### ContactMedium Array

```sql
ARRAY[
    ROW(
        'emailAddress'::text,    -- mediumType
        true::boolean,           -- preferred
        ROW('email@example.com'::text)::"tmf"."ContactMediumCharacteristic"
    )::"tmf"."ContactMedium"
]::"tmf"."ContactMedium"[] AS "contactMedium"
```

---

## Testing Mappings

### Check All Mappings Status

```bash
curl "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/mappings" | jq
```

### Test Individual Mapping

```bash
# Test Service
curl "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/service?limit=1" | jq

# Test ProductOrder
curl "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productOrderingManagement/v5/productOrder?limit=1" | jq

# Test Individual
curl "http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/individual?limit=1" | jq
```

---

## Troubleshooting Mappings

### Error: "Error parsing JSONB: null"

**Cause**: TMF server's JsonbRowMapper can't parse the complex type  
**Solution**: Ensure all nested ROW constructors have correct type casting

```sql
-- Check: Every ROW must have explicit type cast
ROW(...)::"tmf"."TypeName"
```

### Error: mapped: false in /mappings

**Cause**: View doesn't exist or has wrong schema  
**Solution**: 
1. Check view exists: `\dv salesforce_server.entityName`
2. Verify column names match TMF schema exactly
3. Ensure `@type`, `@baseType`, `@schemaLocation` columns exist

### Error: Empty Response

**Cause**: Base table has no data or WHERE clause too restrictive  
**Solution**: 
1. Check source table: `SELECT COUNT(*) FROM salesforce_server."Source_Object__c"`
2. Remove restrictive WHERE clauses for testing










