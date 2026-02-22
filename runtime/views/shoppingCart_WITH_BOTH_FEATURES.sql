-- =====================================================================
-- ShoppingCart View - WITH BOTH ARRAY_AGG AND relatedParty
-- =====================================================================
-- This version demonstrates the TMF server limitation:
-- ARRAY_AGG + complex relatedParty = 500 errors at scale
-- 
-- Test results:
--   ✅ limit=1-7: Works
--   ❌ limit=10+: 500 internal error
-- 
-- Root cause: TMF server can't serialize this combination
-- =====================================================================

DROP VIEW IF EXISTS salesforce_server."shoppingCart";
CREATE VIEW salesforce_server."shoppingCart" AS
SELECT
    t0."Id"::text AS id,
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/shoppingCart/v5/shoppingCart/' || t0."Id")::text AS href,
    t0."CreatedDate"::timestamp with time zone AS "creationDate",
    t0."LastModifiedDate"::timestamp with time zone AS "lastUpdate",
    t0."csordtelcoa__Basket_Stage__c"::text AS "status",
    NULL::tmf."TimePeriod" AS "validFor",
    NULL::tmf."OneOfContactMedium"[] AS "contactMedium",
    NULL::tmf."CartPrice"[] AS "cartTotalPrice",
    
    -- ========================================
    -- FEATURE 1: ARRAY_AGG for cartItem
    -- ========================================
    ARRAY_AGG(
        ROW(
            'add'::text,
            t1."Id"::text,
            COALESCE(t1."cscfga__Quantity__c", 1)::integer,
            CASE 
                WHEN t1."cscfga__Configuration_Status__c" = 'Valid' THEN 'active'
                WHEN t1."cscfga__Configuration_Status__c" = 'Invalid' THEN 'rejected'
                ELSE 'active'
            END::text,
            NULL::tmf."CartTerm"[],
            NULL::jsonb[],
            NULL::tmf."Note"[],
            CASE WHEN t1."cscfga__total_contract_value__c" IS NOT NULL THEN
                ARRAY[
                    ROW(
                        'Item Total'::text,
                        'TCV'::text,
                        'total'::text,
                        NULL::tmf."ProductOfferingPriceRef",
                        NULL::text,
                        NULL::text,
                        ROW(
                            NULL::tmf."Money",
                            NULL::double precision,
                            ROW('MYR'::text, COALESCE(t1."cscfga__total_contract_value__c", 0)::double precision)::tmf."Money",
                            NULL::double precision,
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
            END,  -- itemTotalPrice
            ROW(
                NULL::jsonb,
                ROW(
                    t1."cscfga__Product_Definition__c"::text,
                    NULL::text,
                    t1."Name"::text,
                    NULL::text,
                    'ProductRef'::text,
                    'Product'::text,
                    NULL::text
                )::tmf."ProductRef"
            )::tmf."OneOfProductRefOrValue",
            NULL::tmf."CartPrice"[],
            NULL::tmf."OneOfProductOfferingRef",
            NULL::tmf."CartItemRelationship"[],
            'CartItem'::text,
            'CartItem'::text,
            NULL::text
        )::tmf."CartItem"
    ) FILTER (WHERE t1."Id" IS NOT NULL)::tmf."CartItem"[] AS "cartItem",
    
    -- ========================================
    -- FEATURE 2: relatedParty with Customer + Creator
    -- ========================================
    CASE 
        WHEN t0."csordtelcoa__Account__c" IS NOT NULL THEN
            ARRAY[
                -- Customer
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
    END AS "relatedParty"
    
FROM salesforce_server."cscfga__Product_Basket__c" t0
LEFT JOIN salesforce_server."cscfga__Product_Configuration__c" t1 
    ON t1."cscfga__Product_Basket__c" = t0."Id"
GROUP BY 
    t0."Id",
    t0."csordtelcoa__Basket_Stage__c",
    t0."CreatedDate",
    t0."LastModifiedDate",
    t0."csordtelcoa__Account__c",
    t0."CreatedById";

-- =====================================================================
-- ISSUE: This view causes 500 errors at limit=10+
-- 
-- The combination of:
--   1. ARRAY_AGG(...complex CartItem structure...)
--   2. relatedParty with nested ROW constructors
--   3. GROUP BY aggregation
-- 
-- Is too complex for TMF server to serialize at scale.
-- 
-- Separately they work:
--   ✅ ARRAY_AGG alone: Works at any limit
--   ✅ relatedParty alone: Works at any limit
--   ❌ Both together: Fails at limit=10+
-- =====================================================================
