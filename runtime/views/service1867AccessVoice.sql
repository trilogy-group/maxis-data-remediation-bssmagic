-- =====================================================================
-- 1867 Detection: Access & Voice Solution - Access Service (Partial Data Missing)
-- =====================================================================
-- Detects Access services that are missing mandatory OE fields:
--   - Billing Account: Billing_Account__c
--   - PIC Email: Billing_Account__c -> Contact__c -> Email
-- =====================================================================

DROP VIEW IF EXISTS salesforce_server."service1867AccessVoice";
CREATE VIEW salesforce_server."service1867AccessVoice" AS
SELECT
    -- Service identification
    svc."Id"::text AS "id",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/service1867AccessVoice/' || svc."Id")::text AS "href",
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
    
    ba."Contact__c"::text AS "billingContactId",
    cont."Email"::text AS "picEmail",  -- Should NOT be NULL
    CASE WHEN cont."Email" IS NULL THEN true ELSE false END::boolean AS "missingPicEmail",
    
    -- External ID (for reference)
    svc."External_ID__c"::text AS "externalId",
    
    -- Migration indicators
    svc."Migrated_To_Heroku__c"::boolean AS "migratedToHeroku",
    svc."Migrated_Data__c"::boolean AS "migratedData",
    
    -- Dates
    svc."CreatedDate"::timestamp with time zone AS "createdDate",
    svc."LastModifiedDate"::timestamp with time zone AS "lastModifiedDate",
    
    -- TMF required fields
    'Service1867AccessVoice'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
    
FROM salesforce_server."csord__Service__c" svc
LEFT JOIN salesforce_server."csord__Subscription__c" sub 
    ON svc."csord__Subscription__c" = sub."Id"
LEFT JOIN salesforce_server."Account" acct 
    ON sub."csord__Account__c" = acct."Id"
LEFT JOIN salesforce_server."csconta__Billing_Account__c" ba 
    ON svc."Billing_Account__c" = ba."Id"
LEFT JOIN salesforce_server."Contact" cont 
    ON ba."Contact__c" = cont."Id"
WHERE 
    svc."Service_Type__c" = 'Access Service'
    AND svc."csord__Subscription__c" IS NOT NULL
    -- Detect missing mandatory fields
    AND (svc."Billing_Account__c" IS NULL OR cont."Email" IS NULL)
    -- Recent records only for performance
    AND svc."LastModifiedDate" >= NOW() - INTERVAL '180 days';





