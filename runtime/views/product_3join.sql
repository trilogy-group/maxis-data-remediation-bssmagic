-- Product View with 3 JOINs (Solution + Account + Subscription + Service)

DROP VIEW IF EXISTS salesforce_server."product";
CREATE VIEW salesforce_server."product" AS
SELECT
    t0."Name"::text AS name,
    t0."csord__Status__c"::text AS status,
    true::boolean AS "isBundle",
    t0."CreatedDate"::timestamp with time zone AS "creationDate",
    -- billingAccount
    CASE WHEN t0."csord__Account__c" IS NOT NULL THEN
        ROW(
            NULL::text, t0."csord__Account__c"::text,
            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/billingAccount/' || t0."csord__Account__c")::text,
            MAX(acct."Name")::text, 'BillingAccount'::text, NULL::text, NULL::text, NULL::text
        )::tmf."BillingAccountRef"
    ELSE NULL::tmf."BillingAccountRef" END AS "billingAccount",
    -- product[] 
    ARRAY_AGG(
        ROW(NULL::jsonb, ROW(sub."Id"::text, ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product/' || sub."Id")::text, sub."Name"::text, 'Product'::text, 'ProductRef'::text, NULL::text, NULL::text)::tmf."ProductRef")::tmf."OneOfProductRefOrValue"
    ) FILTER (WHERE sub."Id" IS NOT NULL)::tmf."OneOfProductRefOrValue"[] AS "product",
    -- realizingService[]
    ARRAY_AGG(
        ROW(svc."Id"::text, ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/service/' || svc."Id")::text, svc."Name"::text, 'Service'::text, 'ServiceRef'::text, NULL::text, NULL::text)::tmf."ServiceRef"
    ) FILTER (WHERE svc."Id" IS NOT NULL)::tmf."ServiceRef"[] AS "realizingService",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product/' || t0."Id")::text AS href,
    t0."Id"::text AS id,
    'Product'::text AS "@type", 'Product'::text AS "@baseType", NULL::text AS "@schemaLocation"
FROM salesforce_server."csord__Solution__c" t0
LEFT JOIN salesforce_server."Account" acct ON t0."csord__Account__c" = acct."Id"
LEFT JOIN salesforce_server."csord__Subscription__c" sub ON sub."csord__Solution__c" = t0."Id"
LEFT JOIN salesforce_server."csord__Service__c" svc ON svc."csord__Subscription__c" = sub."Id"
GROUP BY t0."Id", t0."Name", t0."csord__Status__c", t0."CreatedDate", t0."csord__Account__c";
