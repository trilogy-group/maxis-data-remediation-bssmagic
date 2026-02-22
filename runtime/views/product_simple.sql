-- Simplified Product View (TMF637)
-- No JOINs - just csord__Solution__c
-- For testing Salesforce rate limits

DROP VIEW IF EXISTS salesforce_server."product";
CREATE VIEW salesforce_server."product" AS
SELECT
    t0."Name"::text AS name,
    t0."csord__Status__c"::text AS status,
    true::boolean AS "isBundle",
    t0."CreatedDate"::timestamp with time zone AS "creationDate",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product/' || t0."Id")::text AS href,
    t0."Id"::text AS id,
    'Product'::text AS "@type",
    'Product'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM salesforce_server."csord__Solution__c" t0;
