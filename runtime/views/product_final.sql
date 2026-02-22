-- =====================================================================
-- Product View (TMF637) - FINAL OPTIMIZED VERSION
-- =====================================================================
-- Source: csord__Solution__c 
-- Endpoint: /tmf-api/productInventory/v5/product
--
-- OPTIMIZATION: Only 1 JOIN (Account) to avoid FDW rate limiting
--
-- What's included:
--   ✅ All pricing (TCV, RC, OTC)
--   ✅ Status for filtering (csord__External_Identifier__c)
--   ✅ Customer (Account) with name
--   ✅ Creator with name (via CASE for known IDs - no JOIN!)
--   ✅ Product characteristics
--   ✅ Contract terms
--   ✅ MACD relationships
--
-- What's excluded (query separately to avoid rate limiting):
--   ❌ product[] array (Subscription children)
--   ❌ realizingService[] (Services)
--   ❌ productOffering (Product Definition)
--
-- Known User IDs (for creator name without JOIN):
--   Migration User: 0052v00000gz1pSAAQ
-- =====================================================================

DROP VIEW IF EXISTS salesforce_server."product";
CREATE VIEW salesforce_server."product" AS
SELECT
    -- ========================================
    -- AGREEMENT (NULL - no agreement tracking)
    -- ========================================
    NULL::tmf."AgreementItemRef"[] AS "agreementItem",
    
    -- ========================================
    -- BILLING ACCOUNT (from Account JOIN)
    -- ========================================
    CASE WHEN t0."csord__Account__c" IS NOT NULL THEN
        ROW(
            NULL::text,                                    -- accountNumber
            t0."csord__Account__c"::text,                  -- id
            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/billingAccount/' || t0."csord__Account__c")::text,
            acct."Name"::text,                             -- name (from JOIN)
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
    true::boolean AS "isBundle",
    true::boolean AS "isCustomerVisible",
    
    -- ========================================
    -- PRODUCT CHARACTERISTICS
    -- ========================================
    ARRAY[
        -- solutionStatus
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
        -- isMigrated flag
        ROW(
            NULL::tmf."Characteristic",
            NULL::tmf."BooleanArrayCharacteristic",
            ROW(
                t0."Is_Migrated_to_Heroku__c"::boolean,
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
        )::tmf."OneOfCharacteristic"
    ]::tmf."OneOfCharacteristic"[] AS "productCharacteristic",
    
    -- ========================================
    -- PRODUCT OFFERING (NULL - requires extra JOINs)
    -- ========================================
    NULL::tmf."OneOfProductOfferingRef" AS "productOffering",
    NULL::tmf."RelatedOrderItem"[] AS "productOrderItem",
    
    -- ========================================
    -- PRODUCT[] - NULL (query separately via x_parentBundleId)
    -- ========================================
    NULL::tmf."OneOfProductRefOrValue"[] AS "product",
    
    -- ========================================
    -- PRODUCT PRICE (TCV, RC, OTC) - Full pricing!
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
    -- PRODUCT RELATIONSHIP (MACD: replaces/replacedBy)
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
    ROW(
        NULL::text,
        NULL::text,
        t0."Id"::text,
        ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productSpecification/' || t0."Id")::text,
        t0."Name"::text,
        NULL::text,
        'ProductSpecification'::text,
        NULL::text,
        NULL::text
    )::tmf."ProductSpecificationRef" AS "productSpecification",
    
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
    -- REALIZING RESOURCE & SERVICE (NULL - query separately)
    -- ========================================
    NULL::tmf."ResourceRef"[] AS "realizingResource",
    NULL::tmf."ServiceRef"[] AS "realizingService",
    
    -- ========================================
    -- RELATED PARTY (Customer + Creator)
    -- Customer: from Account JOIN
    -- Creator: via CASE for known IDs (NO JOIN!)
    -- ========================================
    ARRAY[
        -- Customer (Account) - with name from JOIN
        CASE WHEN t0."csord__Account__c" IS NOT NULL THEN
            ROW(
                'customer'::text,
                ROW(
                    ROW(
                        t0."csord__Account__c"::text,
                        ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/organization/' || t0."csord__Account__c")::text,
                        COALESCE(acct."Name", 'Unknown')::text,
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
        ELSE NULL::tmf."RelatedPartyOrPartyRole"
        END,
        -- Creator (User) - name from CASE (NO JOIN!)
        ROW(
            'creator'::text,
            ROW(
                ROW(
                    t0."CreatedById"::text,
                    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/individual/' || t0."CreatedById")::text,
                    CASE 
                        WHEN t0."CreatedById" = '0052v00000gz1pSAAQ' THEN 'Migration User'
                        ELSE 'Unknown User'
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
    ]::tmf."RelatedPartyOrPartyRole"[] AS "relatedParty",
    
    -- ========================================
    -- PLACE (NULL - not tracked)
    -- ========================================
    NULL::tmf."RelatedPlaceRefOrValue"[] AS "place",
    
    -- ========================================
    -- STATUS (Migration status for filtering)
    -- Values: "Not Migrated Successfully", "Completed", etc.
    -- ========================================
    t0."csord__External_Identifier__c"::text AS "status",
    
    -- ========================================
    -- INTENT (NULL)
    -- ========================================
    NULL::tmf."OneOfIntentRefOrValue" AS "intent",
    
    -- ========================================
    -- TMF CORE FIELDS
    -- ========================================
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product/' || t0."Id")::text AS "href",
    t0."Id"::text AS "id",
    'Product'::text AS "@type",
    'Product'::text AS "@baseType",
    NULL::text AS "@schemaLocation"

-- ========================================
-- FROM + SINGLE JOIN (Account only!)
-- ========================================
FROM salesforce_server."csord__Solution__c" t0
LEFT JOIN salesforce_server."Account" acct ON t0."csord__Account__c" = acct."Id"
WHERE t0."Id" IS NOT NULL;
