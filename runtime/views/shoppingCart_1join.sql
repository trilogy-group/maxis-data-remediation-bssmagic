-- ShoppingCart View (TMF663) - 1-JOIN Version
-- Maps: cscfga__Product_Basket__c -> shoppingCart
-- 
-- Enhanced from original: Adds quantity, status, pricing from Product Configuration
-- Keeps productOffering and cartItemRelationship as NULL (complex casting issues)
--
-- JOINs:
--   t0 = cscfga__Product_Basket__c (basket) - 5 columns available
--   t1 = cscfga__Product_Configuration__c (cart items) - many columns available

DROP VIEW IF EXISTS salesforce_server."shoppingCart";
CREATE VIEW salesforce_server."shoppingCart" AS
SELECT
    NULL::tmf."TimePeriod" AS "validFor",
    NULL::tmf."OneOfContactMedium"[] AS "contactMedium",
    NULL::tmf."CartPrice"[] AS "cartTotalPrice",
    
    -- cartItem: ARRAY_AGG with enhanced data from Product Configuration
    ARRAY_AGG(
        ROW(
            'add'::text,                                        -- action
            t1."Id"::text,                                      -- id
            COALESCE(t1."cscfga__Quantity__c", 1)::integer,     -- quantity (actual!)
            COALESCE(
                CASE 
                    WHEN t1."cscfga__Configuration_Status__c" = 'Valid' THEN 'active'
                    WHEN t1."cscfga__Configuration_Status__c" = 'Invalid' THEN 'rejected'
                    WHEN t1."cscfga__Configuration_Status__c" = 'Incomplete' THEN 'pending'
                    WHEN t1."cscfga__Configuration_Status__c" = 'Pending' THEN 'pending'
                    WHEN t1."cscfga__Configuration_Status__c" = 'Cancelled' THEN 'cancelled'
                    WHEN t1."cscfga__Configuration_Status__c" = 'Saved' THEN 'active'
                    WHEN t1."cscfga__Configuration_Status__c" = 'Submitted' THEN 'active'
                    ELSE 'active'
                END,
                'active'
            )::text,                                            -- status (mapped!)
            NULL::tmf."CartTerm"[],                             -- itemTerm
            NULL::jsonb[],                                      -- (reserved)
            NULL::tmf."Note"[],                                 -- note
            -- itemTotalPrice (from Product Configuration TCV)
            CASE WHEN t1."cscfga__total_contract_value__c" IS NOT NULL THEN
                ARRAY[
                    ROW(
                        'Item Total'::text,                     -- description
                        'TCV'::text,                            -- name
                        'total'::text,                          -- priceType
                        NULL::tmf."ProductOfferingPriceRef",    -- productOfferingPrice
                        NULL::text,                             -- recurringChargePeriod
                        NULL::text,                             -- unitOfMeasure
                        ROW(
                            NULL::tmf."Money",                  -- dutyFreeAmount
                            NULL::double precision,             -- percentage
                            ROW(
                                'MYR'::text,                    -- unit (currency)
                                t1."cscfga__total_contract_value__c"::double precision  -- value
                            )::tmf."Money",                     -- taxIncludedAmount
                            NULL::double precision,             -- taxRate
                            'Price'::text,                      -- @type
                            'Price'::text,                      -- @baseType
                            NULL::text                          -- @schemaLocation
                        )::tmf."Price",                         -- price
                        NULL::tmf."PriceAlteration"[],          -- priceAlteration
                        'CartPrice'::text,                      -- @type
                        'CartPrice'::text,                      -- @baseType
                        NULL::text                              -- @schemaLocation
                    )::tmf."CartPrice"
                ]::tmf."CartPrice"[]
            ELSE NULL::tmf."CartPrice"[]
            END,
            -- product (ProductRef - using Product Definition ID and Config Name)
            ROW(
                NULL::jsonb,
                ROW(
                    t1."cscfga__Product_Definition__c"::text,   -- id
                    NULL::text,                                 -- href
                    t1."Name"::text,                            -- name (config name)
                    NULL::text,                                 -- description
                    'ProductRef'::text,                         -- @type
                    'Ref'::text,                                -- @baseType
                    NULL::text                                  -- @schemaLocation
                )::tmf."ProductRef"
            )::tmf."OneOfProductRefOrValue",
            -- itemPrice (keep simple for now)
            NULL::tmf."CartPrice"[],
            -- productOffering (NULL - complex casting)
            NULL::tmf."OneOfProductOfferingRef",
            -- cartItemRelationship (NULL - complex casting)
            NULL::tmf."CartItemRelationship"[],
            'CartItem'::text,                                   -- @type
            'CartItem'::text,                                   -- @baseType
            NULL::text                                          -- @schemaLocation
        )::tmf."CartItem"
    ) FILTER (WHERE t1."Id" IS NOT NULL)::tmf."CartItem"[] AS "cartItem",
    
    -- relatedParty: NULL (basket FDW doesn't have Account column)
    NULL::tmf."RelatedPartyOrPartyRole"[] AS "relatedParty",
    
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
    
FROM salesforce_server."cscfga__Product_Basket__c" t0
LEFT JOIN salesforce_server."cscfga__Product_Configuration__c" t1 
    ON t1."cscfga__Product_Basket__c" = t0."Id"
GROUP BY 
    t0."Id",
    t0."csordtelcoa__Basket_Stage__c",
    t0."CreatedDate",
    t0."LastModifiedDate";
