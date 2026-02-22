-- =====================================================================
-- Service View (TMF638) - WITH 1867 detection + enrichment fields
-- =====================================================================
-- Maps: csord__Service__c -> service
-- 
-- JOINs: NONE (all direct field references for maximum performance)
--
-- 1867 detection logic:
--   Migrated_Data__c = true (equivalent to CreatedBy.Name = 'Migration User')
--   Service_Type__c IN (Voice, Fibre Service, eSMS Service, Access Service)
--     Note: Service_Type__c is a superset of PD Name via PC->PD 2-hop.
--     ~7% overshoot from auto-archived PDs (e.g. 'Voice [Auto Archived ...]')
--     is filtered at OE validation step (Apex API checks actual PD Name).
--   csordtelcoa__Replacement_Service__c IS NULL (excludes MACD replacements)
-- =====================================================================

DROP VIEW IF EXISTS salesforce_server."service" CASCADE;
CREATE VIEW salesforce_server."service" AS
SELECT
    -- Core TMF Service fields
    svc."Id"::text AS id,
    svc."Name"::text AS "name",
    svc."Service_Type__c"::text AS "serviceType",
    svc."csord__Status__c"::text AS "state",
    svc."CreatedDate"::timestamp with time zone AS "startDate",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/service/' || svc."Id")::text AS href,
    'Service'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation",
    
    -- Custom fields for 1867 detection (all direct - NO JOINs!)
    svc."Service_Type__c"::text AS "x_serviceType",
    svc."External_ID__c"::text AS "x_externalId",
    svc."Billing_Account__c"::text AS "x_billingAccountId",
    svc."cssdm__solution_association__c"::text AS "x_solutionId",
    svc."csord__Subscription__c"::text AS "x_subscriptionId",
    svc."Account__c"::text AS "x_accountId",
    svc."Migrated_Data__c"::boolean AS "x_migratedData",
    svc."Migrated_To_Heroku__c"::boolean AS "x_migratedToHeroku",
    
    -- Replacement service (MACD scenario exclusion)
    svc."csordtelcoa__Replacement_Service__c"::text AS "x_replacementServiceId",
    
    -- PIC Email directly from Service record (avoids 3-hop BA->Contact->Individual)
    svc."Authorized_PIC_Email__c"::text AS "x_picEmail",
    
    -- Product Configuration reference (for PD Name resolution if needed)
    svc."csordtelcoa__Product_Configuration__c"::text AS "x_productConfigurationId",
    
    -- 1867 Detection flag
    CASE 
        WHEN svc."Migrated_Data__c" = true 
        AND svc."Service_Type__c" IN ('Voice', 'Fibre Service', 'eSMS Service', 'Access Service')
        AND svc."csordtelcoa__Replacement_Service__c" IS NULL
        THEN true ELSE false 
    END::boolean AS "x_has1867Issue",
    
    -- Parent Bundle ID (MCBDIR-129)
    svc."csordtelcoa__Parent_Product_Configuration__c"::text AS "x_parentBundleId"
    
FROM salesforce_server."csord__Service__c" svc;
