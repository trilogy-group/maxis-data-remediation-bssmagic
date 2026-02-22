-- =====================================================================
-- Product View (TMF637) - FOCUSED VERSION (0-JOINs)
-- =====================================================================
-- Essential fields only to avoid TMF serialization issues
-- 
-- Mapped fields:
--   ✅ Id, Name, Description
--   ✅ relatedParty[creator] - CreatedById
--   ✅ relatedParty[customer] - Account ID
--   ✅ billingAccount - Account ID
--   ✅ status - External Identifier
--   ✅ productSpecification - Solution Definition ID
--   ✅ productPrice - TCV, RC, OTC
--   ✅ productCharacteristic - Status, IsMigratedToHeroku (minimal)
-- =====================================================================

DROP VIEW IF EXISTS salesforce_server."product";
CREATE VIEW salesforce_server."product" AS
SELECT
    -- Core fields
    t0."Id"::text AS id,
    t0."Name"::text AS name,
    t0."Name"::text AS description,
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/product/' || t0."Id")::text AS href,
    'Product'::text AS "@type",
    'Product'::text AS "@baseType",
    NULL::text AS "@schemaLocation",
    
    -- Dates
    t0."CreatedDate"::timestamp with time zone AS "creationDate",
    t0."Bundle_Start_Date__c"::timestamp with time zone AS "startDate",
    t0."Bundle_End_Date__c"::timestamp with time zone AS "terminationDate",
    
    -- Status from External Identifier
    t0."csord__External_Identifier__c"::text AS status,
    
    -- Flags
    true::boolean AS "isBundle",
    true::boolean AS "isCustomerVisible",
    
    -- Product Specification (Solution Definition)
    CASE WHEN t0."cssdm__solution_definition__c" IS NOT NULL THEN
        ROW(
            NULL::text,                                    -- version
            NULL::tmf."TargetProductSchema",               -- targetProductSchema
            t0."cssdm__solution_definition__c"::text,      -- id
            NULL::text,                                    -- href
            NULL::text,                                    -- name
            'ProductSpecification'::text,                  -- @referredType
            'ProductSpecificationRef'::text,               -- @type
            NULL::text,                                    -- @baseType
            NULL::text                                     -- @schemaLocation
        )::tmf."ProductSpecificationRef"
    ELSE NULL::tmf."ProductSpecificationRef"
    END AS "productSpecification",
    
    -- Billing Account (Account ID only - no JOIN)
    CASE WHEN t0."csord__Account__c" IS NOT NULL THEN
        ROW(
            NULL::text,
            t0."csord__Account__c"::text,
            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/accountManagement/v5/billingAccount/' || t0."csord__Account__c")::text,
            NULL::text,
            'BillingAccount'::text,
            NULL::text,
            NULL::text,
            NULL::text
        )::tmf."BillingAccountRef"
    ELSE NULL::tmf."BillingAccountRef"
    END AS "billingAccount",
    
    -- Related Party: Customer + Creator (minimal structure)
    ARRAY_REMOVE(ARRAY[
        -- Customer (Account)
        CASE WHEN t0."csord__Account__c" IS NOT NULL THEN
            ROW(
                'customer'::text,
                ROW(
                    ROW(
                        t0."csord__Account__c"::text,
                        ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/organization/' || t0."csord__Account__c")::text,
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
        -- Creator (with name from CASE for known users)
        CASE WHEN t0."CreatedById" IS NOT NULL THEN
            ROW(
                'creator'::text,
                ROW(
                    ROW(
                        t0."CreatedById"::text,                           -- id
                        NULL::text,                                       -- href
                        CASE 
                            WHEN t0."CreatedById" = '0052v00000gz1pSAAQ' THEN 'Migration User'
                            ELSE NULL 
                        END::text,                                        -- name
                        'User'::text,                                     -- @referredType
                        'PartyRef'::text,                                 -- @type
                        NULL::text,                                       -- @baseType
                        NULL::text                                        -- @schemaLocation
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
    ], NULL)::tmf."RelatedPartyOrPartyRole"[] AS "relatedParty",
    
    -- Product Price: TCV, RC, OTC (using correct type structure)
    ARRAY[
        -- TCV (Total Contract Value)
        ROW(
            'Total Contract Value'::text,                  -- description
            'TCV'::text,                                   -- name
            NULL::tmf."ProductOfferingPriceRef",           -- productOfferingPrice
            NULL::text,                                    -- recurringChargePeriod
            NULL::text,                                    -- unitOfMeasure
            ROW(
                ROW('MYR', t0."cssdm__total_contract_value__c"::real)::tmf."Money",
                NULL::real,
                NULL::tmf."Money",
                NULL::real,
                'Price'::text,
                NULL::text,
                NULL::text
            )::tmf."Price",                                -- price
            NULL::tmf."PriceAlteration"[],                 -- priceAlteration
            'nonRecurring'::text,                          -- priceType
            'ProductPrice'::text,                          -- @type
            NULL::text,                                    -- @baseType
            NULL::text                                     -- @schemaLocation
        )::tmf."ProductPrice",
        -- RC (Recurring Charge)
        ROW(
            'Monthly Recurring Charge'::text,
            'RC'::text,
            NULL::tmf."ProductOfferingPriceRef",
            'monthly'::text,
            NULL::text,
            ROW(
                ROW('MYR', t0."cssdm__total_recurring_charge__c"::real)::tmf."Money",
                NULL::real,
                NULL::tmf."Money",
                NULL::real,
                'Price'::text,
                NULL::text,
                NULL::text
            )::tmf."Price",
            NULL::tmf."PriceAlteration"[],
            'recurring'::text,
            'ProductPrice'::text,
            NULL::text,
            NULL::text
        )::tmf."ProductPrice",
        -- OTC (One-Time Charge)
        ROW(
            'One-Time Charge'::text,
            'OTC'::text,
            NULL::tmf."ProductOfferingPriceRef",
            NULL::text,
            NULL::text,
            ROW(
                ROW('MYR', t0."cssdm__total_one_off_charge__c"::real)::tmf."Money",
                NULL::real,
                NULL::tmf."Money",
                NULL::real,
                'Price'::text,
                NULL::text,
                NULL::text
            )::tmf."Price",
            NULL::tmf."PriceAlteration"[],
            'nonRecurring'::text,
            'ProductPrice'::text,
            NULL::text,
            NULL::text
        )::tmf."ProductPrice"
    ]::tmf."ProductPrice"[] AS "productPrice",
    
    -- Product Characteristic (minimal - just 2)
    ARRAY[
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
            ROW(t0."csord__Status__c", 'solutionStatus', 'string', 'string', NULL, NULL, NULL, NULL)::tmf."StringCharacteristic",
            NULL::tmf."CdrCharacteristic",
            NULL::tmf."MapAnyCharacteristicValue"
        )::tmf."OneOfCharacteristic",
        ROW(
            NULL::tmf."Characteristic",
            NULL::tmf."BooleanArrayCharacteristic",
            ROW(COALESCE(t0."Is_Migrated_to_Heroku__c", false), 'isMigratedToHeroku', 'boolean', 'boolean', NULL, NULL, NULL, NULL)::tmf."BooleanCharacteristic",
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
    
    -- NULL fields (not needed for this use case)
    NULL::tmf."AgreementItemRef"[] AS "agreementItem",
    NULL::tmf."OneOfProductOfferingRef" AS "productOffering",
    NULL::tmf."RelatedOrderItem"[] AS "productOrderItem",
    NULL::tmf."OneOfProductRefOrValue"[] AS product,
    NULL::tmf."ProductRelationship"[] AS "productRelationship",
    NULL::tmf."ProductTerm"[] AS "productTerm",
    NULL::tmf."ResourceRef"[] AS "realizingResource",
    NULL::tmf."ServiceRef"[] AS "realizingService",
    NULL::tmf."RelatedPlaceRefOrValue"[] AS place,
    NULL::tmf."OneOfIntentRefOrValue" AS intent,
    t0."Solution_Number__c"::text AS "productSerialNumber"

FROM salesforce_server."csord__Solution__c" t0;
