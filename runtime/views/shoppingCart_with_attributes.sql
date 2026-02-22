-- ShoppingCart with Attributes Test View
-- Purpose: Test if WHERE clause pushdown makes Attributes viable
-- 
-- Hypothesis: When querying with id='specific_basket', the FDW should
-- only fetch Attributes for that basket's configurations, not all 7.5M
--
-- JOINs: Basket → Product Config → Attribute (3 JOINs)

DROP VIEW IF EXISTS salesforce_server."shoppingCart_test";
CREATE VIEW salesforce_server."shoppingCart_test" AS
SELECT
    t0."Id"::text AS id,
    t0."Name"::text AS name,
    t0."csordtelcoa__Basket_Stage__c"::text AS status,
    -- Count of configurations
    COUNT(DISTINCT t1."Id")::integer AS config_count,
    -- Count of attributes (if this works, we can expand to full array)
    COUNT(DISTINCT attr."Id")::integer AS attribute_count,
    -- Sample attribute names (to verify we're getting data)
    STRING_AGG(DISTINCT attr."Name", ', ' ORDER BY attr."Name") AS sample_attributes
FROM salesforce_server."cscfga__Product_Basket__c" t0
LEFT JOIN salesforce_server."cscfga__Product_Configuration__c" t1 
    ON t1."cscfga__Product_Basket__c" = t0."Id"
LEFT JOIN salesforce_server."cscfga__Attribute__c" attr 
    ON attr."cscfga__Product_Configuration__c" = t1."Id"
    AND attr."cscfga__Hidden__c" = false 
    AND attr."cscfga__is_active__c" = true
GROUP BY 
    t0."Id",
    t0."Name",
    t0."csordtelcoa__Basket_Stage__c";
