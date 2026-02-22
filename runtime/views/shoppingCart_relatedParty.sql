-- =====================================================================
-- ShoppingCart View (TMF663) - relatedParty Version
-- =====================================================================
-- Maps: cscfga__Product_Basket__c -> shoppingCart
--
-- This version prioritizes relatedParty (customer, creator, owner)
-- over cartItem aggregation to avoid TMF server serialization issues.
--
-- Trade-off:
--   ✅ relatedParty: Working (customer from Account, creator from CreatedBy)
--   ❌ cartItem: NULL (query Product Configurations separately if needed)
--
-- Use shoppingCart_cartItem.sql for cart item details instead.
-- =====================================================================

DROP VIEW IF EXISTS salesforce_server."shoppingCart";
CREATE VIEW salesforce_server."shoppingCart" AS
SELECT
    NULL::tmf."TimePeriod" AS "validFor",
    NULL::tmf."OneOfContactMedium"[] AS "contactMedium",
    
    -- cartTotalPrice from basket-level fields
    CASE WHEN t0."cscfga__total_contract_value__c" IS NOT NULL THEN
        ARRAY[
            ROW(
                'Total Contract Value'::text,           -- description
                'TCV'::text,                            -- name
                'total'::text,                          -- priceType
                NULL::tmf."ProductOfferingPriceRef",    -- productOfferingPrice
                NULL::text,                             -- recurringChargePeriod
                NULL::text,                             -- unitOfMeasure
                ROW(
                    NULL::tmf."Money",                  -- dutyFreeAmount
                    NULL::double precision,             -- percentage
                    ROW(
                        'MYR'::text,                    -- unit
                        t0."cscfga__total_contract_value__c"::double precision
                    )::tmf."Money",                     -- taxIncludedAmount
                    NULL::double precision,             -- taxRate
                    'Price'::text,
                    'Price'::text,
                    NULL::text
                )::tmf."Price",
                NULL::tmf."PriceAlteration"[],
                'CartPrice'::text,
                'CartPrice'::text,
                NULL::text
            )::tmf."CartPrice"
        ]::tmf."CartPrice"[]
    ELSE NULL::tmf."CartPrice"[]
    END AS "cartTotalPrice",
    
    -- cartItem: NULL in this version (use separate query for items)
    NULL::tmf."CartItem"[] AS "cartItem",
    
    -- relatedParty: Customer + Creator + Owner
    CASE 
        WHEN t0."csordtelcoa__Account__c" IS NOT NULL THEN
            ARRAY[
                -- Customer (from Account)
                ROW(
                    'customer'::text,
                    ROW(
                        ROW(
                            t0."csordtelcoa__Account__c"::text,
                            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/organization/' || t0."csordtelcoa__Account__c")::text,
                            NULL::text,
                            'Organization'::text,
                            'PartyRef'::text,
                            NULL::text,
                            NULL::text
                        )::tmf."PartyRef",
                        NULL::tmf."PartyRoleRef",
                        NULL::tmf."Individual",
                        NULL::tmf."Organization",
                        NULL::tmf."OneOfPartyRole",
                        NULL::tmf."Supplier",
                        NULL::tmf."BusinessPartner",
                        NULL::tmf."Consumer",
                        NULL::tmf."Producer"
                    )::tmf."OneOfPartyOrPartyRole",
                    'RelatedPartyOrPartyRole'::text,
                    NULL::text,
                    NULL::text
                )::tmf."RelatedPartyOrPartyRole",
                -- Creator
                ROW(
                    'creator'::text,
                    ROW(
                        ROW(
                            t0."CreatedById"::text,
                            NULL::text,
                            NULL::text,
                            'Individual'::text,
                            'PartyRef'::text,
                            NULL::text,
                            NULL::text
                        )::tmf."PartyRef",
                        NULL::tmf."PartyRoleRef",
                        NULL::tmf."Individual",
                        NULL::tmf."Organization",
                        NULL::tmf."OneOfPartyRole",
                        NULL::tmf."Supplier",
                        NULL::tmf."BusinessPartner",
                        NULL::tmf."Consumer",
                        NULL::tmf."Producer"
                    )::tmf."OneOfPartyOrPartyRole",
                    'RelatedPartyOrPartyRole'::text,
                    NULL::text,
                    NULL::text
                )::tmf."RelatedPartyOrPartyRole"
            ]::tmf."RelatedPartyOrPartyRole"[]
        ELSE
            -- No customer, just creator
            ARRAY[
                ROW(
                    'creator'::text,
                    ROW(
                        ROW(
                            t0."CreatedById"::text,
                            NULL::text,
                            NULL::text,
                            'Individual'::text,
                            'PartyRef'::text,
                            NULL::text,
                            NULL::text
                        )::tmf."PartyRef",
                        NULL::tmf."PartyRoleRef",
                        NULL::tmf."Individual",
                        NULL::tmf."Organization",
                        NULL::tmf."OneOfPartyRole",
                        NULL::tmf."Supplier",
                        NULL::tmf."BusinessPartner",
                        NULL::tmf."Consumer",
                        NULL::tmf."Producer"
                    )::tmf."OneOfPartyOrPartyRole",
                    'RelatedPartyOrPartyRole'::text,
                    NULL::text,
                    NULL::text
                )::tmf."RelatedPartyOrPartyRole"
            ]::tmf."RelatedPartyOrPartyRole"[]
    END AS "relatedParty",
    
    -- status (CRITICAL for filtering)
    t0."csordtelcoa__Basket_Stage__c"::text AS "status",
    
    -- timestamps
    t0."CreatedDate"::timestamp with time zone AS "creationDate",
    t0."LastModifiedDate"::timestamp with time zone AS "lastUpdate",
    
    -- identity
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/shoppingCart/v5/shoppingCart/' || t0."Id")::text AS href,
    t0."Id"::text AS id,
    'ShoppingCart'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
    
FROM salesforce_server."cscfga__Product_Basket__c" t0;
