-- =====================================================================
-- Service View (TMF638) - STABLE VERSION (Zero JOINs)
-- =====================================================================
-- Maps: csord__Service__c -> service
-- 
-- OPTIMIZATION: ZERO JOINs for maximum stability
--   - All fields direct from csord__Service__c
--   - No JOINs (avoids FDW full table scans and TMF server errors)
--
-- What's included:
--   ✅ Core service info (id, name, type, state)
--   ✅ All direct IDs (billing account, solution, subscription, account)
--   ✅ Migration flags for 1867 detection
--   ✅ Fast queries (limit=300 works)
--
-- What's excluded (fetched by gateway during patching):
--   ❌ x_billingAccountName (JOIN needed)
--   ❌ x_picEmail (JOIN needed)
--   Workaround: Gateway enriches from Salesforce when patching
-- =====================================================================

DROP VIEW IF EXISTS salesforce_server."service";
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
    
    -- 1867 Detection flag (all migrated services are candidates)
    CASE 
        WHEN svc."Migrated_Data__c" = true 
        AND svc."Service_Type__c" IN ('Voice', 'Fibre Service', 'eSMS Service', 'Access Service') 
        THEN true ELSE false 
    END::boolean AS "x_has1867Issue"
    
FROM salesforce_server."csord__Service__c" svc;
-- NO JOINs for maximum stability and speed
