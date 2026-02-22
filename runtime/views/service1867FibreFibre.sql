-- =====================================================================
-- 1867 Detection: Fibre Solution - Fibre Service OE (Partial Data Missing)
-- =====================================================================
-- Detects Fibre services that are missing mandatory OE fields:
--   - Billing Account: Billing_Account__c
-- =====================================================================

DROP VIEW IF EXISTS salesforce_server."service1867FibreFibre";
CREATE VIEW salesforce_server."service1867FibreFibre" AS
SELECT
    -- Service identification
    svc."Id"::text AS "id",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/service1867FibreFibre/' || svc."Id")::text AS "href",
    svc."Name"::text AS "serviceName",
    svc."Service_Type__c"::text AS "serviceType",
    svc."csord__Status__c"::text AS "serviceStatus",
    
    -- Subscription and Account context
    svc."csord__Subscription__c"::text AS "subscriptionId",
    sub."Name"::text AS "subscriptionName",
    sub."csord__Account__c"::text AS "accountId",
    acct."Name"::text AS "accountName",
    
    -- 1867 Mandatory Fields Check
    svc."Billing_Account__c"::text AS "billingAccountId",  -- Should NOT be NULL
    ba."Name"::text AS "billingAccountName",
    CASE WHEN svc."Billing_Account__c" IS NULL THEN true ELSE false END::boolean AS "missingBillingAccount",
    
    -- External ID (for reference)
    svc."External_ID__c"::text AS "externalId",
    
    -- Migration indicators
    svc."Migrated_To_Heroku__c"::boolean AS "migratedToHeroku",
    svc."Migrated_Data__c"::boolean AS "migratedData",
    
    -- Dates
    svc."CreatedDate"::timestamp with time zone AS "createdDate",
    svc."LastModifiedDate"::timestamp with time zone AS "lastModifiedDate",
    
    -- TMF required fields
    'Service1867FibreFibre'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
    
FROM salesforce_server."csord__Service__c" svc
LEFT JOIN salesforce_server."csord__Subscription__c" sub 
    ON svc."csord__Subscription__c" = sub."Id"
LEFT JOIN salesforce_server."Account" acct 
    ON sub."csord__Account__c" = acct."Id"
LEFT JOIN salesforce_server."csconta__Billing_Account__c" ba 
    ON svc."Billing_Account__c" = ba."Id"
WHERE 
    svc."Service_Type__c" = 'Fibre Service'
    AND svc."csord__Subscription__c" IS NOT NULL
    -- Detect missing mandatory fields
    AND svc."Billing_Account__c" IS NULL
    -- Recent records only for performance
    AND svc."LastModifiedDate" >= NOW() - INTERVAL '180 days';





