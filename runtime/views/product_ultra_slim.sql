-- Product View (TMF637) - ULTRA SLIM (NO JOINs)
-- Minimal view to test FDW connectivity without rate limiting
DROP VIEW IF EXISTS salesforce_server."product";
CREATE VIEW salesforce_server."product" AS
SELECT
    NULL::tmf."AgreementItemRef"[] AS "agreementItem",
    NULL::tmf."BillingAccountRef" AS "billingAccount",
    t0."CreatedDate"::timestamp with time zone AS "creationDate",
    t0."CreatedDate"::timestamp with time zone AS "orderDate",
    t0."Bundle_Start_Date__c"::timestamp with time zone AS "startDate",
    t0."Bundle_End_Date__c"::timestamp with time zone AS "terminationDate",
    t0."Name"::text AS "description",
    t0."Name"::text AS "name",
    true::boolean AS "isBundle",
    true::boolean AS "isCustomerVisible",
    NULL::tmf."OneOfCharacteristic"[] AS "productCharacteristic",
    NULL::tmf."OneOfProductOfferingRef" AS "productOffering",
    NULL::tmf."RelatedOrderItem"[] AS "productOrderItem",
    NULL::tmf."OneOfProductRefOrValue"[] AS "product",
    NULL::tmf."ProductPrice"[] AS "productPrice",
    NULL::tmf."ProductRelationship"[] AS "productRelationship",
    t0."Solution_Number__c"::text AS "productSerialNumber",
    NULL::tmf."ProductSpecificationRef" AS "productSpecification",
    NULL::tmf."ProductTerm"[] AS "productTerm",
    NULL::tmf."ResourceRef"[] AS "realizingResource",
    NULL::tmf."ServiceRef"[] AS "realizingService",
    NULL::tmf."RelatedPartyOrPartyRole"[] AS "relatedParty",
    NULL::tmf."RelatedPlaceRefOrValue"[] AS "place",
    t0."csord__Status__c"::text AS "status",
    NULL::tmf."OneOfIntentRefOrValue" AS "intent",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product/' || t0."Id")::text AS "href",
    t0."Id"::text AS "id",
    'Product'::text AS "@type",
    'Product'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM salesforce_server."csord__Solution__c" t0;
