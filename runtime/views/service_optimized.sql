-- =====================================================================
-- Service View (TMF638) - OPTIMIZED with 3 JOINs
-- =====================================================================
-- Maps: csord__Service__c -> service
-- 
-- OPTIMIZATION: Reduced from 5 JOINs to 3 JOINs
--   - Removed: csord__Solution__c JOIN (ID comes from Subscription)
--   - Removed: Account JOIN (ID comes from Subscription)
--   - Kept: Subscription, Billing Account, Contact (for 1867)
--
-- Custom fields (x_) include IDs for related entities:
--   - x_subscriptionId: Direct from Service
--   - x_solutionId: From Subscription (no Solution JOIN needed)
--   - x_accountId: From Subscription (no Account JOIN needed)
-- =====================================================================

DROP VIEW IF EXISTS salesforce_server."service";
CREATE VIEW salesforce_server."service" AS
SELECT
    -- Standard TMF Service fields
    NULL::text AS "description",
    true::boolean AS "isServiceEnabled",
    true::boolean AS "hasStarted",
    NULL::text AS "startMode",
    false::boolean AS "isStateful",
    svc."CreatedDate"::timestamp with time zone AS "startDate",
    NULL::timestamp with time zone AS "endDate",
    NULL::jsonb[] AS "serviceOrderItem",
    NULL::jsonb[] AS "note",
    svc."Service_Type__c"::text AS "serviceType",
    false::boolean AS "isBundle",
    svc."Name"::text AS "name",
    NULL::text AS "category",
    NULL::jsonb[] AS "feature",
    NULL::jsonb[] AS "relatedEntity",
    NULL::jsonb[] AS "externalIdentifier",
    NULL::jsonb[] AS "serviceCharacteristic",
    NULL::jsonb[] AS "serviceRelationship",
    NULL::jsonb[] AS "supportingService",
    NULL::jsonb[] AS "supportingResource",
    NULL::jsonb[] AS "relatedParty",
    NULL::jsonb[] AS "place",
    svc."csord__Status__c"::text AS "state",
    NULL::text AS "operatingStatus",
    NULL::jsonb AS "serviceSpecification",
    svc."CreatedDate"::timestamp with time zone AS "serviceDate",
    NULL::jsonb AS "intent",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/service/' || svc."Id")::text AS href,
    svc."Id"::text AS id,
    'Service'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation",
    
    -- 1867 Detection Fields (x_ prefix)
    svc."Service_Type__c"::text AS "x_serviceType",
    svc."External_ID__c"::text AS "x_externalId",
    svc."Billing_Account__c"::text AS "x_billingAccountId",
    ba."Name"::text AS "x_billingAccountName",
    cont."Email"::text AS "x_picEmail",
    
    -- Related entity IDs (no extra JOINs needed!)
    svc."csord__Subscription__c"::text AS "x_subscriptionId",
    sub."csord__Solution__c"::text AS "x_solutionId",
    sub."csord__Account__c"::text AS "x_accountId",
    
    -- Salesforce field presence flags
    CASE WHEN svc."Billing_Account__c" IS NULL THEN true ELSE false END::boolean AS "x_missingBillingAccount",
    CASE WHEN cont."Email" IS NULL THEN true ELSE false END::boolean AS "x_missingPicEmail",
    CASE WHEN svc."External_ID__c" IS NULL THEN true ELSE false END::boolean AS "x_missingExternalId",
    
    -- Migration flags
    svc."Migrated_To_Heroku__c"::boolean AS "x_migratedToHeroku",
    svc."Migrated_Data__c"::boolean AS "x_migratedData",
    
    -- 1867 CANDIDATE flags
    CASE
        WHEN svc."Migrated_Data__c" = true
        AND svc."Service_Type__c" = 'Voice'
        AND (svc."External_ID__c" IS NULL OR cont."Email" IS NULL)
        THEN true ELSE false
    END::boolean AS "x_fibreVoiceOE",

    CASE
        WHEN svc."Migrated_Data__c" = true
        AND svc."Service_Type__c" = 'Fibre Service'
        AND svc."Billing_Account__c" IS NULL
        THEN true ELSE false
    END::boolean AS "x_fibreFibreOE",

    CASE
        WHEN svc."Migrated_Data__c" = true
        AND svc."Service_Type__c" = 'eSMS Service'
        AND (svc."External_ID__c" IS NULL OR cont."Email" IS NULL)
        THEN true ELSE false
    END::boolean AS "x_mobileESMSOE",

    CASE
        WHEN svc."Migrated_Data__c" = true
        AND svc."Service_Type__c" = 'Access Service'
        AND (svc."Billing_Account__c" IS NULL OR cont."Email" IS NULL)
        THEN true ELSE false
    END::boolean AS "x_accessVoiceOE",

    CASE
        WHEN svc."Migrated_Data__c" = true
        AND svc."Service_Type__c" IN ('Voice', 'Fibre Service', 'eSMS Service', 'Access Service')
        THEN true ELSE false
    END::boolean AS "x_has1867Issue"
    
FROM salesforce_server."csord__Service__c" svc
-- JOIN 1: Subscription (needed for Solution ID and Account ID)
LEFT JOIN salesforce_server."csord__Subscription__c" sub 
    ON svc."csord__Subscription__c" = sub."Id"
-- JOIN 2: Billing Account (needed for 1867 detection)
LEFT JOIN salesforce_server."csconta__Billing_Account__c" ba 
    ON svc."Billing_Account__c" = ba."Id"
-- JOIN 3: Contact (needed for PIC Email)
LEFT JOIN salesforce_server."Contact" cont 
    ON ba."Contact__c" = cont."Id";
