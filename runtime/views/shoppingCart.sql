-- =====================================================================
-- ShoppingCart View - WITH BOTH ARRAY_AGG AND relatedParty
-- =====================================================================
-- FIXED VERSION - Both features working together!
-- 
-- Test results:
--   ✅ limit=100: Works
--   ✅ cartItem (ARRAY_AGG): Working
--   ✅ relatedParty (customer + creator): Working
-- 
-- Previous issues were SQL syntax errors (not TMF server limitations):
--   1. "AS alias" inside ROW() - invalid syntax
--   2. FILTER on ARRAY[] - only valid on aggregate functions
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
    
    -- cartTotalPrice from Total Price field
    CASE WHEN t0."cscfga__Total_Price__c" IS NOT NULL THEN
        ARRAY[
            ROW(
                'Cart Total'::text,
                'Total'::text,
                'total'::text,
                NULL::tmf."ProductOfferingPriceRef",
                NULL::text,
                NULL::text,
                ROW(
                    NULL::tmf."Money",
                    NULL::double precision,
                    ROW('MYR'::text, t0."cscfga__Total_Price__c"::double precision)::tmf."Money",
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
    END AS "cartTotalPrice",
    
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
    -- FEATURE 2: relatedParty with Customer + Creator + BillingAccount
    -- Using ARRAY_REMOVE to filter NULLs
    -- ========================================
    ARRAY_REMOVE(ARRAY[
        -- Customer (Account)
        CASE WHEN t0."csordtelcoa__Account__c" IS NOT NULL THEN
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
            )::tmf."RelatedPartyOrPartyRole"
        ELSE NULL END,
        -- Billing Account (PartyRoleRef)
        CASE WHEN t0."Billing_Account__c" IS NOT NULL THEN
            ROW(
                'billingAccount'::text,
                ROW(
                    NULL::tmf."PartyRef",
                    ROW(
                        NULL::text,
                        NULL::text,
                        t0."Billing_Account__c"::text,
                        ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/accountManagement/v5/billingAccount/' || t0."Billing_Account__c")::text,
                        NULL::text,
                        'BillingAccount'::text,
                        'PartyRoleRef'::text,
                        NULL::text,
                        NULL::text
                    )::tmf."PartyRoleRef",
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
        ELSE NULL END,
        -- Creator (User)
        CASE WHEN t0."CreatedById" IS NOT NULL THEN
            ROW(
                'creator'::text,
                ROW(
                    ROW(
                        t0."CreatedById"::text,
                        NULL::text,
                        NULL::text,
                        'User'::text,
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
        ELSE NULL END
    ], NULL)::tmf."RelatedPartyOrPartyRole"[] AS "relatedParty"
    
FROM salesforce_server."cscfga__Product_Basket__c" t0
LEFT JOIN salesforce_server."cscfga__Product_Configuration__c" t1 
    ON t1."cscfga__Product_Basket__c" = t0."Id"
GROUP BY 
    t0."Id",
    t0."csordtelcoa__Basket_Stage__c",
    t0."CreatedDate",
    t0."LastModifiedDate",
    t0."csordtelcoa__Account__c",
    t0."Billing_Account__c",
    t0."cscfga__Total_Price__c",
    t0."CreatedById";

-- =====================================================================
-- FIXED: This view now works with both features at limit=100+
-- 
-- The original issues were SQL syntax errors:
--   1. "AS itemTotalPrice" inside ROW() - invalid (removed)
--   2. FILTER on ARRAY[] - only valid on aggregates (removed)
-- 
-- The combination of ARRAY_AGG + relatedParty works fine when SQL is correct.
-- =====================================================================
