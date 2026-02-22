-- 1867 Scenario Candidates: Fibre Solution — Fibre Service OE (fibre-only)
-- Returns Fibre Solutions linked to a Product Basket where Fibre flag is true and Voice flag is false.
-- Endpoint (after schema registration): /tmf-api/productInventory/v5/solution1867FibreOnly

DROP VIEW IF EXISTS salesforce_server."solution1867FibreOnly";
CREATE VIEW salesforce_server."solution1867FibreOnly" AS
SELECT
    t0."Id"::text AS "solutionId",
    t0."Name"::text AS "solutionName",
    t0."CreatedDate"::timestamp with time zone AS "solutionCreatedDate",
    sd."Name"::text AS "solutionDefinitionName",
    t0."isFibreService__c"::boolean AS "isFibreService",
    t0."isVoiceService__c"::boolean AS "isVoiceService",
    t0."hasESMS__c"::boolean AS "hasESMS",
    t0."isESMSService__c"::boolean AS "isESMSService",
    t0."isMobileSolution__c"::boolean AS "isMobileSolution",

    t0."cssdm__product_basket__c"::text AS "basketId",
    b."Name"::text AS "basketName",
    b."Basket_Stage_UI__c"::text AS "basketStageUI",
    b."cscfga__Basket_Status__c"::text AS "basketStatus",

    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productInventory/v5/solution1867FibreOnly/' || t0."Id")::text AS href,
    t0."Id"::text AS id,
    'Solution1867FibreOnly'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM salesforce_server."csord__Solution__c" t0
LEFT JOIN salesforce_server."cssdm__Solution_Definition__c" sd
  ON t0."cssdm__solution_definition__c" = sd."Id"
LEFT JOIN salesforce_server."cscfga__Product_Basket__c" b
  ON t0."cssdm__product_basket__c" = b."Id"
WHERE t0."cssdm__product_basket__c" IS NOT NULL
  AND sd."Name" IN ('Fibre Solution', 'mPower Fibre Solution')
  AND t0."isFibreService__c" = true
  AND t0."isVoiceService__c" = false;









