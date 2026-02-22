-- Product View with 1 JOIN (Solution + Account only)
-- Testing if JOINs cause the issue

DROP VIEW IF EXISTS salesforce_server."product";
CREATE VIEW salesforce_server."product" AS
SELECT
    t0."Name"::text AS name,
    t0."csord__Status__c"::text AS status,
    true::boolean AS "isBundle",
    t0."CreatedDate"::timestamp with time zone AS "creationDate",
    -- billingAccount from Account
    CASE WHEN t0."csord__Account__c" IS NOT NULL THEN
        ROW(
            NULL::text,
            t0."csord__Account__c"::text,
            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/billingAccount/' || t0."csord__Account__c")::text,
            acct."Name"::text,
            'BillingAccount'::text,
            NULL::text,
            NULL::text,
            NULL::text
        )::tmf."BillingAccountRef"
    ELSE NULL::tmf."BillingAccountRef"
    END AS "billingAccount",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product/' || t0."Id")::text AS href,
    t0."Id"::text AS id,
    'Product'::text AS "@type",
    'Product'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM salesforce_server."csord__Solution__c" t0
LEFT JOIN salesforce_server."Account" acct ON t0."csord__Account__c" = acct."Id";
