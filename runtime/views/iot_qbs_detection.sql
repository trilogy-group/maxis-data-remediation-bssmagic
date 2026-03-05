-- =====================================================================
-- IoT QBS Held Orchestration Detection View
-- =====================================================================
-- Maps: CSPOFA__Orchestration_Process__c -> salesforce_server."iotQbsHeldOrchestration"
-- Endpoint: /tmf-api/iotQbsManagement/v1/iotQbsHeldOrchestration
--
-- Detects orchestration processes that are on hold with the IoT fulfillment
-- template, indicating a potential QBS index mismatch that needs remediation.
--
-- Detection criteria (from LLD v2):
--   1. CSPOFA__Process_On_Hold__c = true
--   2. Template = "Order Fulfillment Process IOT"
--   3. Orchestration has an associated order
--
-- IMPORTANT: All filterable columns use direct references (no COALESCE/CASE)
-- to ensure FDW pushes WHERE clauses to Salesforce SOQL.
-- =====================================================================

DROP VIEW IF EXISTS salesforce_server."iotQbsHeldOrchestration";

CREATE OR REPLACE VIEW salesforce_server."iotQbsHeldOrchestration" AS
SELECT
    t0."Id"::text AS "id",
    t0."Id"::text AS "orchestrationProcessId",
    t0."Name"::text AS "name",
    t0."CSPOFA__Process_On_Hold__c"::text AS "onHold",
    t0."CSPOFA__Orchestration_Process_Template__r.Name"::text AS "templateName",
    t0."Order__c"::text AS "orderId",
    t0."CreatedDate"::text AS "createdDate",
    t0."LastModifiedDate"::text AS "lastModifiedDate"
FROM salesforce_server."CSPOFA__Orchestration_Process__c" t0
WHERE t0."CSPOFA__Process_On_Hold__c" = true
  AND t0."CSPOFA__Orchestration_Process_Template__r.Name" = 'Order Fulfillment Process IOT';
