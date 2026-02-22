-- =====================================================================
-- Product View (TMF637) - Full Version (Zero JOINs)
-- =====================================================================
-- Source: csord__Solution__c 
-- Endpoint: /tmf-api/productInventory/v5/product
--
-- OPTIMIZATION: ZERO JOINs for maximum stability
--
-- What's included:
--   ✅ All pricing (TCV, RC, OTC) with currency
--   ✅ Status for filtering (csord__External_Identifier__c)
--   ✅ relatedParty with customer AND creator (enables Migration User filter)
--   ✅ Product characteristics (status, migration, service flags)
--   ✅ Contract terms
--   ✅ MACD relationships (replaces/replacedBy)
--   ✅ Product serial number
--   ✅ All date fields
--   ✅ Billing account reference
--   ✅ Product specification
--
-- Known User IDs (for creator name without JOIN):
--   Migration User: 0052v00000gz1pSAAQ
-- =====================================================================

DROP VIEW IF EXISTS salesforce_server."product";
CREATE VIEW salesforce_server."product" AS
SELECT
    -- ========================================
    -- AGREEMENT (NULL)
    -- ========================================
    NULL::tmf."AgreementItemRef"[] AS "agreementItem",
    
    -- ========================================
    -- BILLING ACCOUNT (ID only - no JOIN for name)
    -- ========================================
    CASE WHEN t0."csord__Account__c" IS NOT NULL THEN
        ROW(
            NULL::text,                                    -- accountNumber
            t0."csord__Account__c"::text,                  -- id
            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/billingAccount/' || t0."csord__Account__c")::text,
            NULL::text,                                    -- name (would need JOIN)
            'BillingAccount'::text,
            NULL::text,
            NULL::text,
            NULL::text
        )::tmf."BillingAccountRef"
    ELSE NULL::tmf."BillingAccountRef"
    END AS "billingAccount",
    
    -- ========================================
    -- DATES
    -- ========================================
    t0."CreatedDate"::timestamp with time zone AS "creationDate",
    t0."CreatedDate"::timestamp with time zone AS "orderDate",
    COALESCE(t0."Bundle_Start_Date__c", t0."CreatedDate")::timestamp with time zone AS "startDate",
    COALESCE(t0."Termination_Due_Date__c"::timestamp, t0."Bundle_End_Date__c")::timestamp with time zone AS "terminationDate",
    
    -- ========================================
    -- DESCRIPTION & NAME
    -- ========================================
    COALESCE(t0."Product_Name__c", t0."Name")::text AS "description",
    t0."Name"::text AS "name",
    
    -- ========================================
    -- BUNDLE FLAGS
    -- ========================================
    COALESCE(t0."isBundleSolution__c", true)::boolean AS "isBundle",
    true::boolean AS "isCustomerVisible",
    
    -- ========================================
    -- PRODUCT CHARACTERISTICS (Rich set from Solution fields)
    -- ========================================
    ARRAY[
        -- solutionStatus (internal workflow status)
        ROW(
            NULL::tmf."Characteristic",
            NULL::tmf."BooleanArrayCharacteristic",
            NULL::tmf."BooleanCharacteristic",
            NULL::tmf."FloatArrayCharacteristic",
            NULL::tmf."FloatCharacteristic",
            NULL::tmf."IntegerArrayCharacteristic",
            NULL::tmf."IntegerCharacteristic",
            NULL::tmf."NumberArrayCharacteristic",
            NULL::tmf."NumberCharacteristic",
            NULL::tmf."ObjectArrayCharacteristic",
            NULL::tmf."ObjectCharacteristic",
            NULL::tmf."StringArrayCharacteristic",
            ROW(
                COALESCE(t0."csord__Status__c", 'Unknown')::text,
                NULL::text,
                'solutionStatus'::text,
                'string'::text,
                NULL::tmf."CharacteristicRelationship"[],
                'StringCharacteristic'::text,
                NULL::text,
                NULL::text
            )::tmf."StringCharacteristic",
            NULL::tmf."CdrCharacteristic",
            NULL::tmf."MapAnyCharacteristicValue"
        )::tmf."OneOfCharacteristic",
        -- bundleStatus
        ROW(
            NULL::tmf."Characteristic",
            NULL::tmf."BooleanArrayCharacteristic",
            NULL::tmf."BooleanCharacteristic",
            NULL::tmf."FloatArrayCharacteristic",
            NULL::tmf."FloatCharacteristic",
            NULL::tmf."IntegerArrayCharacteristic",
            NULL::tmf."IntegerCharacteristic",
            NULL::tmf."NumberArrayCharacteristic",
            NULL::tmf."NumberCharacteristic",
            NULL::tmf."ObjectArrayCharacteristic",
            NULL::tmf."ObjectCharacteristic",
            NULL::tmf."StringArrayCharacteristic",
            ROW(
                COALESCE(t0."Bundle_Status__c", 'Unknown')::text,
                NULL::text,
                'bundleStatus'::text,
                'string'::text,
                NULL::tmf."CharacteristicRelationship"[],
                'StringCharacteristic'::text,
                NULL::text,
                NULL::text
            )::tmf."StringCharacteristic",
            NULL::tmf."CdrCharacteristic",
            NULL::tmf."MapAnyCharacteristicValue"
        )::tmf."OneOfCharacteristic",
        -- solutionType
        ROW(
            NULL::tmf."Characteristic",
            NULL::tmf."BooleanArrayCharacteristic",
            NULL::tmf."BooleanCharacteristic",
            NULL::tmf."FloatArrayCharacteristic",
            NULL::tmf."FloatCharacteristic",
            NULL::tmf."IntegerArrayCharacteristic",
            NULL::tmf."IntegerCharacteristic",
            NULL::tmf."NumberArrayCharacteristic",
            NULL::tmf."NumberCharacteristic",
            NULL::tmf."ObjectArrayCharacteristic",
            NULL::tmf."ObjectCharacteristic",
            NULL::tmf."StringArrayCharacteristic",
            ROW(
                COALESCE(t0."csord__Type__c", 'Unknown')::text,
                NULL::text,
                'solutionType'::text,
                'string'::text,
                NULL::tmf."CharacteristicRelationship"[],
                'StringCharacteristic'::text,
                NULL::text,
                NULL::text
            )::tmf."StringCharacteristic",
            NULL::tmf."CdrCharacteristic",
            NULL::tmf."MapAnyCharacteristicValue"
        )::tmf."OneOfCharacteristic",
        -- isMigratedToHeroku
        ROW(
            NULL::tmf."Characteristic",
            NULL::tmf."BooleanArrayCharacteristic",
            ROW(
                COALESCE(t0."Is_Migrated_to_Heroku__c", false)::boolean,
                NULL::text,
                'isMigratedToHeroku'::text,
                'boolean'::text,
                NULL::tmf."CharacteristicRelationship"[],
                'BooleanCharacteristic'::text,
                NULL::text,
                NULL::text
            )::tmf."BooleanCharacteristic",
            NULL::tmf."FloatArrayCharacteristic",
            NULL::tmf."FloatCharacteristic",
            NULL::tmf."IntegerArrayCharacteristic",
            NULL::tmf."IntegerCharacteristic",
            NULL::tmf."NumberArrayCharacteristic",
            NULL::tmf."NumberCharacteristic",
            NULL::tmf."ObjectArrayCharacteristic",
            NULL::tmf."ObjectCharacteristic",
            NULL::tmf."StringArrayCharacteristic",
            NULL::tmf."StringCharacteristic",
            NULL::tmf."CdrCharacteristic",
            NULL::tmf."MapAnyCharacteristicValue"
        )::tmf."OneOfCharacteristic",
        -- isVoiceService
        ROW(
            NULL::tmf."Characteristic",
            NULL::tmf."BooleanArrayCharacteristic",
            ROW(
                COALESCE(t0."isVoiceService__c", false)::boolean,
                NULL::text,
                'isVoiceService'::text,
                'boolean'::text,
                NULL::tmf."CharacteristicRelationship"[],
                'BooleanCharacteristic'::text,
                NULL::text,
                NULL::text
            )::tmf."BooleanCharacteristic",
            NULL::tmf."FloatArrayCharacteristic",
            NULL::tmf."FloatCharacteristic",
            NULL::tmf."IntegerArrayCharacteristic",
            NULL::tmf."IntegerCharacteristic",
            NULL::tmf."NumberArrayCharacteristic",
            NULL::tmf."NumberCharacteristic",
            NULL::tmf."ObjectArrayCharacteristic",
            NULL::tmf."ObjectCharacteristic",
            NULL::tmf."StringArrayCharacteristic",
            NULL::tmf."StringCharacteristic",
            NULL::tmf."CdrCharacteristic",
            NULL::tmf."MapAnyCharacteristicValue"
        )::tmf."OneOfCharacteristic",
        -- isFibreService
        ROW(
            NULL::tmf."Characteristic",
            NULL::tmf."BooleanArrayCharacteristic",
            ROW(
                COALESCE(t0."isFibreService__c", false)::boolean,
                NULL::text,
                'isFibreService'::text,
                'boolean'::text,
                NULL::tmf."CharacteristicRelationship"[],
                'BooleanCharacteristic'::text,
                NULL::text,
                NULL::text
            )::tmf."BooleanCharacteristic",
            NULL::tmf."FloatArrayCharacteristic",
            NULL::tmf."FloatCharacteristic",
            NULL::tmf."IntegerArrayCharacteristic",
            NULL::tmf."IntegerCharacteristic",
            NULL::tmf."NumberArrayCharacteristic",
            NULL::tmf."NumberCharacteristic",
            NULL::tmf."ObjectArrayCharacteristic",
            NULL::tmf."ObjectCharacteristic",
            NULL::tmf."StringArrayCharacteristic",
            NULL::tmf."StringCharacteristic",
            NULL::tmf."CdrCharacteristic",
            NULL::tmf."MapAnyCharacteristicValue"
        )::tmf."OneOfCharacteristic",
        -- isMobileSolution
        ROW(
            NULL::tmf."Characteristic",
            NULL::tmf."BooleanArrayCharacteristic",
            ROW(
                COALESCE(t0."isMobileSolution__c", false)::boolean,
                NULL::text,
                'isMobileSolution'::text,
                'boolean'::text,
                NULL::tmf."CharacteristicRelationship"[],
                'BooleanCharacteristic'::text,
                NULL::text,
                NULL::text
            )::tmf."BooleanCharacteristic",
            NULL::tmf."FloatArrayCharacteristic",
            NULL::tmf."FloatCharacteristic",
            NULL::tmf."IntegerArrayCharacteristic",
            NULL::tmf."IntegerCharacteristic",
            NULL::tmf."NumberArrayCharacteristic",
            NULL::tmf."NumberCharacteristic",
            NULL::tmf."ObjectArrayCharacteristic",
            NULL::tmf."ObjectCharacteristic",
            NULL::tmf."StringArrayCharacteristic",
            NULL::tmf."StringCharacteristic",
            NULL::tmf."CdrCharacteristic",
            NULL::tmf."MapAnyCharacteristicValue"
        )::tmf."OneOfCharacteristic"
    ]::tmf."OneOfCharacteristic"[] AS "productCharacteristic",
    
    -- ========================================
    -- PRODUCT OFFERING (NULL - requires 2 JOINs)
    -- ========================================
    NULL::tmf."OneOfProductOfferingRef" AS "productOffering",
    NULL::tmf."RelatedOrderItem"[] AS "productOrderItem",
    
    -- ========================================
    -- PRODUCT[] - NULL (query separately)
    -- ========================================
    NULL::tmf."OneOfProductRefOrValue"[] AS "product",
    
    -- ========================================
    -- PRODUCT PRICE (TCV, RC, OTC) - FULL PRICING!
    -- ========================================
    CASE WHEN t0."cssdm__total_contract_value__c" IS NOT NULL 
              AND t0."cssdm__total_contract_value__c" > 0 THEN
        ARRAY[
            -- Total Contract Value
            ROW(
                'Total Contract Value'::text,
                'TCV'::text,
                NULL::tmf."ProductOfferingPriceRef",
                NULL::text,
                NULL::text,
                ROW(
                    NULL::tmf."Money",
                    NULL::real,
                    ROW(COALESCE(t0."CurrencyIsoCode", 'MYR')::text, t0."cssdm__total_contract_value__c"::real)::tmf."Money",
                    NULL::real,
                    'Price'::text,
                    NULL::text,
                    NULL::text
                )::tmf."Price",
                NULL::tmf."PriceAlteration"[],
                'totalContractValue'::text,
                'ProductPrice'::text,
                NULL::text,
                NULL::text
            )::tmf."ProductPrice",
            -- Monthly Recurring Charge
            ROW(
                'Monthly Recurring Charge'::text,
                'RC'::text,
                NULL::tmf."ProductOfferingPriceRef",
                'monthly'::text,
                NULL::text,
                ROW(
                    NULL::tmf."Money",
                    NULL::real,
                    ROW(COALESCE(t0."CurrencyIsoCode", 'MYR')::text, COALESCE(t0."cssdm__total_recurring_charge__c", 0)::real)::tmf."Money",
                    NULL::real,
                    'Price'::text,
                    NULL::text,
                    NULL::text
                )::tmf."Price",
                NULL::tmf."PriceAlteration"[],
                'recurringCharge'::text,
                'ProductPrice'::text,
                NULL::text,
                NULL::text
            )::tmf."ProductPrice",
            -- One-Time Charge
            ROW(
                'One-Time Charge'::text,
                'OTC'::text,
                NULL::tmf."ProductOfferingPriceRef",
                NULL::text,
                NULL::text,
                ROW(
                    NULL::tmf."Money",
                    NULL::real,
                    ROW(COALESCE(t0."CurrencyIsoCode", 'MYR')::text, COALESCE(t0."cssdm__total_one_off_charge__c", 0)::real)::tmf."Money",
                    NULL::real,
                    'Price'::text,
                    NULL::text,
                    NULL::text
                )::tmf."Price",
                NULL::tmf."PriceAlteration"[],
                'oneTimeCharge'::text,
                'ProductPrice'::text,
                NULL::text,
                NULL::text
            )::tmf."ProductPrice"
        ]::tmf."ProductPrice"[]
    ELSE NULL::tmf."ProductPrice"[]
    END AS "productPrice",
    
    -- ========================================
    -- PRODUCT RELATIONSHIP (MACD)
    -- ========================================
    CASE 
        WHEN t0."cssdm__replaced_solution__c" IS NOT NULL THEN
            ARRAY[ROW(
                t0."cssdm__replaced_solution__c"::text,
                'replaces'::text,
                ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product/' || t0."cssdm__replaced_solution__c")::text,
                NULL::text,
                'Product'::text,
                'ProductRelationship'::text,
                NULL::text,
                NULL::text
            )::tmf."ProductRelationship"]::tmf."ProductRelationship"[]
        WHEN t0."Replacement_Solution__c" IS NOT NULL THEN
            ARRAY[ROW(
                t0."Replacement_Solution__c"::text,
                'replacedBy'::text,
                ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product/' || t0."Replacement_Solution__c")::text,
                NULL::text,
                'Product'::text,
                'ProductRelationship'::text,
                NULL::text,
                NULL::text
            )::tmf."ProductRelationship"]::tmf."ProductRelationship"[]
        ELSE NULL::tmf."ProductRelationship"[]
    END AS "productRelationship",
    
    -- ========================================
    -- PRODUCT SERIAL NUMBER
    -- ========================================
    t0."Solution_Number__c"::text AS "productSerialNumber",
    
    -- ========================================
    -- PRODUCT SPECIFICATION (self-reference)
    -- ========================================
    -- Solution Definition reference (not self-reference)
    CASE WHEN t0."cssdm__solution_definition__c" IS NOT NULL THEN
        ROW(
            NULL::text,
            NULL::text,
            t0."cssdm__solution_definition__c"::text,
            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productSpecification/' || t0."cssdm__solution_definition__c")::text,
            NULL::text,
            NULL::text,
            'ProductSpecification'::text,
            NULL::text,
            NULL::text
        )::tmf."ProductSpecificationRef"
    ELSE NULL::tmf."ProductSpecificationRef"
    END AS "productSpecification",
    
    -- ========================================
    -- SHOPPING CART REFERENCE (Product Basket)
    -- Note: cssdm__product_basket__c not mapped (mostly NULL for migrated solutions)
    -- To get basket for a solution, query ShoppingCart API instead
    -- ========================================
    
    -- ========================================
    -- PRODUCT TERM (Contract Duration)
    -- ========================================
    CASE WHEN t0."Contract_Term__c" IS NOT NULL THEN
        ARRAY[ROW(
            'Contract term'::text,
            ROW(t0."Contract_Term__c"::integer, 'month'::text)::tmf."Duration",
            NULL::tmf."TimePeriod",
            'Contract Duration'::text,
            'ProductTerm'::text,
            NULL::text,
            NULL::text
        )::tmf."ProductTerm"]::tmf."ProductTerm"[]
    ELSE NULL::tmf."ProductTerm"[]
    END AS "productTerm",
    
    -- ========================================
    -- REALIZING (NULL - query separately)
    -- ========================================
    NULL::tmf."ResourceRef"[] AS "realizingResource",
    NULL::tmf."ServiceRef"[] AS "realizingService",
    
    -- ========================================
    -- RELATED PARTY (Customer + Creator with Migration User support)
    -- ========================================
    CASE 
        WHEN t0."csord__Account__c" IS NOT NULL THEN
            ARRAY[
                -- Customer (Account)
                ROW(
                    'customer'::text,
                    ROW(
                        ROW(
                            t0."csord__Account__c"::text,
                            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/organization/' || t0."csord__Account__c")::text,
                            NULL::text,  -- name would need JOIN
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
                -- Creator (User) - name via CASE for Migration User
                ROW(
                    'creator'::text,
                    ROW(
                        ROW(
                            t0."CreatedById"::text,
                            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/individual/' || t0."CreatedById")::text,
                            CASE 
                                WHEN t0."CreatedById" = '0052v00000gz1pSAAQ' THEN 'Migration User'
                                ELSE 'System User'
                            END::text,
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
                            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/individual/' || t0."CreatedById")::text,
                            CASE 
                                WHEN t0."CreatedById" = '0052v00000gz1pSAAQ' THEN 'Migration User'
                                ELSE 'System User'
                            END::text,
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
    
    -- ========================================
    -- PLACE (NULL)
    -- ========================================
    NULL::tmf."RelatedPlaceRefOrValue"[] AS "place",
    
    -- ========================================
    -- STATUS (Migration status for filtering)
    -- ========================================
    t0."csord__External_Identifier__c"::text AS "status",
    
    -- ========================================
    -- INTENT (NULL)
    -- ========================================
    NULL::tmf."OneOfIntentRefOrValue" AS "intent",
    
    -- ========================================
    -- RELATED ENTITY (NULL - requires schema update in types.json)
    -- TODO: Add x_shoppingCartId to types.json and redeploy ECS
    -- Then can add: t0."cssdm__product_basket__c"::text AS "x_shoppingCartId"
    -- ========================================
    NULL::"tmf"."RelatedEntityRefOrValue"[] AS "relatedEntity",
    
    -- ========================================
    -- TMF CORE FIELDS
    -- ========================================
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product/' || t0."Id")::text AS "href",
    t0."Id"::text AS "id",
    'Product'::text AS "@type",
    'Product'::text AS "@baseType",
    NULL::text AS "@schemaLocation"

-- ========================================
-- FROM (NO JOINs!)
-- ========================================
FROM salesforce_server."csord__Solution__c" t0
WHERE t0."Id" IS NOT NULL;
