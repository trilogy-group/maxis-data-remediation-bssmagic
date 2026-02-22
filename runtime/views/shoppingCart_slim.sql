-- ShoppingCart View (TMF663) - SLIM VERSION
-- Maps: cscfga__Product_Basket__c -> shoppingCart
-- NO JOINs to avoid FDW rate limiting
--
-- Removed to avoid rate limiting:
--   - cscfga__Product_Configuration__c (cartItem[] - query separately)
--   - cscfga__Product_Definition__c (productOffering details)
--
-- Use cartItem query separately if needed

DROP VIEW IF EXISTS salesforce_server."shoppingCart";
CREATE VIEW salesforce_server."shoppingCart" AS
SELECT
    NULL::tmf."TimePeriod" AS "validFor",
    NULL::tmf."OneOfContactMedium"[] AS "contactMedium",
    NULL::tmf."CartPrice"[] AS "cartTotalPrice",
    -- cartItem: NULL in slim version (query separately to avoid rate limiting)
    NULL::tmf."CartItem"[] AS "cartItem",
    -- relatedParty: NULL
    NULL::tmf."RelatedPartyOrPartyRole"[] AS "relatedParty",
    -- status from Basket_Stage (CRITICAL for filtering)
    t0."csordtelcoa__Basket_Stage__c"::text AS "status",
    t0."CreatedDate"::timestamp with time zone AS "creationDate",
    t0."LastModifiedDate"::timestamp with time zone AS "lastUpdate",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/shoppingCart/v5/shoppingCart/' || t0."Id")::text AS href,
    t0."Id"::text AS id,
    'ShoppingCart'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM salesforce_server."cscfga__Product_Basket__c" t0
WHERE t0."Id" IS NOT NULL;
