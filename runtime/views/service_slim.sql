-- =====================================================================
-- Service View (TMF638) - SLIM VERSION (No JOINs to avoid FDW rate limiting)
-- =====================================================================
-- Maps: csord__Service__c -> service
-- 
-- JOINs REMOVED to avoid Salesforce FDW rate limiting:
--   - csconta__Billing_Account__c (ba)
--   - Contact (cont)
--   - csord__Subscription__c (sub)
--   - Account (acct)
--   - csord__Solution__c (sol)
--
-- The x_* fields that required JOINs now use IDs only (no names)
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
    
    -- 1867 Detection Fields (x_ prefix for custom/extension fields)
    -- IDs only, no names (to avoid JOINs)
    svc."Service_Type__c"::text AS "x_serviceType",
    svc."External_ID__c"::text AS "x_externalId",
    svc."Billing_Account__c"::text AS "x_billingAccountId",
    svc."csord__Subscription__c"::text AS "x_subscriptionId",
    
    -- Salesforce field presence flags
    CASE WHEN svc."Billing_Account__c" IS NULL THEN true ELSE false END::boolean AS "x_missingBillingAccount",
    CASE WHEN svc."External_ID__c" IS NULL THEN true ELSE false END::boolean AS "x_missingExternalId",
    
    -- Migration flags
    svc."Migrated_To_Heroku__c"::boolean AS "x_migratedToHeroku",
    svc."Migrated_Data__c"::boolean AS "x_migratedData",
    
    -- 1867 CANDIDATE flag (simplified - based on migrated data and service type)
    CASE 
        WHEN svc."Migrated_Data__c" = true 
        AND svc."Service_Type__c" IN ('Voice', 'Fibre Service', 'eSMS Service', 'Access Service')
        THEN true 
        ELSE false 
    END::boolean AS "x_has1867Issue"

FROM salesforce_server."csord__Service__c" svc
WHERE svc."Id" IS NOT NULL;
