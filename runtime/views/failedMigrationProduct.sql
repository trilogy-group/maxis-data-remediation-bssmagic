-- FailedMigrationProduct View
-- This view is PRE-FILTERED at the SQL level with WHERE clause baked in
-- The FDW will push this WHERE to Salesforce, returning only failed migrations
-- Endpoint: /tmf-api/productInventory/v5/failedMigrationProduct

DROP VIEW IF EXISTS salesforce_server."failedMigrationProduct";
CREATE VIEW salesforce_server."failedMigrationProduct" AS
SELECT
    t0."Name"::text AS name,
    CONCAT('Solution Type: ', COALESCE(t0."csord__Type__c", 'Unknown'))::text AS description,
    t0."csord__Type__c"::text AS "solutionType",
    t0."csord__Status__c"::text AS status,
    t0."csord__External_Identifier__c"::text AS "migrationStatus",
    t1."Name"::text AS "createdByName",
    t0."CreatedDate"::timestamp with time zone AS "createdDate",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/failedMigrationProduct/' || t0."Id")::text AS href,
    t0."Id"::text AS id,
    'FailedMigrationProduct'::text AS "@type",
    'Product'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM salesforce_server."csord__Solution__c" t0
LEFT JOIN salesforce_server."User" t1 ON t0."CreatedById" = t1."Id"
WHERE t0."csord__External_Identifier__c" = 'Not Migrated Successfully';










