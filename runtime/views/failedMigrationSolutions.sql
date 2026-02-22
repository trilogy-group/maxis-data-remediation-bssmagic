-- Failed Migration Solutions View
-- This is a dedicated view that filters at the Salesforce level
-- Can be accessed via: SELECT * FROM salesforce_server."failedMigrationSolutions"
-- 
-- Note: This view pushes the WHERE clause to Salesforce via FDW

DROP VIEW IF EXISTS salesforce_server."failedMigrationSolutions";
CREATE VIEW salesforce_server."failedMigrationSolutions" AS
SELECT
    t0."Id"::text AS id,
    t0."Name"::text AS name,
    t0."csord__Type__c"::text AS "solutionType",
    t0."csord__Status__c"::text AS status,
    t0."csord__External_Identifier__c"::text AS "migrationStatus",
    t1."Name"::text AS "createdByName",
    t0."CreatedDate"::timestamp with time zone AS "createdDate",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product/' || t0."Id")::text AS href
FROM salesforce_server."csord__Solution__c" t0
LEFT JOIN salesforce_server."User" t1 ON t0."CreatedById" = t1."Id"
WHERE t0."csord__External_Identifier__c" = 'Not Migrated Successfully';










