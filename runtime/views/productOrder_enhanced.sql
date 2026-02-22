-- ProductOrder View (TMF622) - Enhanced Version
-- Maps: csord__Order__c -> productOrder
-- Based on BSS Magic UI mapping with NULL handling fixes

DROP VIEW IF EXISTS salesforce_server."productOrder";
CREATE OR REPLACE VIEW "salesforce_server"."productOrder" AS
SELECT
  NULL::"tmf"."AgreementRef"[] AS "agreement",
  -- billingAccount from Account
  CASE WHEN t1."Id" IS NOT NULL THEN
    ROW(NULL, t1."AccountNumber", ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/billingAccount/' || t1."Id"), t1."Name", 'BillingAccount'::text, NULL::text, NULL::text, NULL::text)::"tmf"."BillingAccountRef"
  ELSE NULL::"tmf"."BillingAccountRef"
  END AS "billingAccount",
  -- state mapping
  CASE 
    WHEN t0."csord__Status2__c" = 'Draft' THEN 'draft'::"tmf"."ProductOrderStateType" 
    WHEN t0."csord__Status2__c" = 'Submitted' THEN 'acknowledged'::"tmf"."ProductOrderStateType" 
    WHEN t0."csord__Status2__c" = 'In Progress' THEN 'inProgress'::"tmf"."ProductOrderStateType" 
    WHEN t0."csord__Status2__c" = 'Completed' THEN 'completed'::"tmf"."ProductOrderStateType" 
    WHEN t0."csord__Status2__c" = 'Cancelled' THEN 'cancelled'::"tmf"."ProductOrderStateType" 
    WHEN t0."csord__Status2__c" = 'Rejected' THEN 'rejected'::"tmf"."ProductOrderStateType" 
    WHEN t0."csord__Status2__c" = 'On Hold' THEN 'held'::"tmf"."ProductOrderStateType" 
    WHEN t0."csord__Status2__c" = 'Failed' THEN 'failed'::"tmf"."ProductOrderStateType" 
    WHEN t0."csord__Status2__c" = 'Partial' THEN 'partial'::"tmf"."ProductOrderStateType" 
    WHEN t0."csord__Status2__c" = 'Order Submitted' THEN 'acknowledged'::"tmf"."ProductOrderStateType"
    ELSE 'pending'::"tmf"."ProductOrderStateType" 
  END AS "state",
  -- requestedInitialState
  CASE 
    WHEN t0."csord__Status2__c" = 'Draft' THEN 'draft'::"tmf"."InitialProductOrderStateType" 
    ELSE 'acknowledged'::"tmf"."InitialProductOrderStateType" 
  END AS "requestedInitialState",
  NULL::timestamp with time zone AS "cancellationDate",
  NULL::text AS "cancellationReason",
  COALESCE(t0."csord__Order_Type__c", 'standard')::text AS "category",
  -- channel (with NULL check)
  CASE 
    WHEN t0."Channel__c" IS NOT NULL THEN 
      ARRAY[ROW(NULL, ROW(NULL, NULL, t0."Channel__c", NULL, NULL, NULL, NULL)::"tmf"."ChannelRef", NULL, NULL, NULL)::"tmf"."RelatedChannel"]::"tmf"."RelatedChannel"[]
    ELSE NULL::"tmf"."RelatedChannel"[]
  END AS "channel",
  -- description with enrichment
  CASE 
    WHEN t0."Comments__c" IS NOT NULL OR t0."csord__Product_Type__c" IS NOT NULL THEN 
      CONCAT_WS(' | ', t0."Comments__c", 
        CASE WHEN t0."csord__Product_Type__c" IS NOT NULL THEN 'Product Type: ' || t0."csord__Product_Type__c" END)
    ELSE NULL 
  END::text AS "description",
  t0."csord__End_Date__c"::timestamp with time zone AS "expectedCompletionDate",
  -- externalId
  CASE 
    WHEN t0."csord__Customer_Order_Number__c" IS NOT NULL THEN 
      ARRAY[ROW(NULL, 'CustomerOrderNumber', t0."csord__Customer_Order_Number__c", NULL, NULL, NULL)::"tmf"."ExternalIdentifier", 
            ROW(NULL, 'OrderNumber', COALESCE(t0."csord__Order_Number__c", t0."Name"), NULL, NULL, NULL)::"tmf"."ExternalIdentifier"]::"tmf"."ExternalIdentifier"[]
    ELSE 
      ARRAY[ROW(NULL, 'OrderNumber', COALESCE(t0."csord__Order_Number__c", t0."Name"), NULL, NULL, NULL)::"tmf"."ExternalIdentifier"]::"tmf"."ExternalIdentifier"[]
  END AS "externalId",
  -- note from Comments
  CASE 
    WHEN t0."Comments__c" IS NOT NULL THEN 
      ARRAY[ROW(NULL, NULL, NULL, t0."Comments__c", NULL, NULL, NULL)::"tmf"."Note"]::"tmf"."Note"[]
    ELSE NULL::"tmf"."Note"[]
  END AS "note",
  -- notificationContact from Account Phone
  t1."Phone"::text AS "notificationContact",
  -- orderTotalPrice (FIXED: Money type is (unit, value) not (value, unit))
  CASE 
    WHEN t0."csord__Total_One_Off_Charges__c" IS NOT NULL THEN 
      ARRAY[ROW(NULL, NULL, NULL, NULL, NULL, NULL, NULL, 
        ROW(
          ROW(COALESCE(t0."CurrencyIsoCode", 'MYR'), t0."csord__Total_One_Off_Charges__c"::real)::"tmf"."Money", 
          NULL, NULL, NULL, NULL, NULL, NULL
        )::"tmf"."Price", 
        NULL, NULL, NULL, NULL)::"tmf"."OrderPrice"]::"tmf"."OrderPrice"[] 
    ELSE NULL::"tmf"."OrderPrice"[] 
  END AS "orderTotalPrice",
  NULL::"tmf"."PaymentRef"[] AS "payment",
  -- orderRelationship to Primary Order
  CASE 
    WHEN t0."csord__Primary_Order__c" IS NOT NULL THEN 
      ARRAY[ROW('ProductOrder', t0."csord__Primary_Order__c", 'dependsOn', 
        ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productOrderingManagement/v5/productOrder/' || t0."csord__Primary_Order__c"), 
        'Primary Order', NULL, NULL, NULL)::"tmf"."OrderRelationship"]::"tmf"."OrderRelationship"[]
    ELSE NULL::"tmf"."OrderRelationship"[]
  END AS "orderRelationship",
  'normal'::text AS "priority",
  NULL::"tmf"."ProductOfferingQualificationRef"[] AS "productOfferingQualification",
  -- quote from Opportunity
  CASE 
    WHEN t0."csordtelcoa__Opportunity__c" IS NOT NULL THEN 
      ARRAY[ROW(t0."csordtelcoa__Opportunity__c", ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/quote/' || t0."csordtelcoa__Opportunity__c"), 'Opportunity Quote', 'Quote', NULL, NULL, NULL)::"tmf"."QuoteRef"]::"tmf"."QuoteRef"[]
    ELSE NULL::"tmf"."QuoteRef"[]
  END AS "quote",
  NULL::"tmf"."ProductOrderErrorMessage"[] AS "productOrderErrorMessage",
  NULL::"tmf"."ProductOrderJeopardyAlert"[] AS "productOrderJeopardyAlert",
  NULL::"tmf"."ProductOrderMilestone"[] AS "productOrderMilestone",
  NULL::"tmf"."ProductOrderItem"[] AS "productOrderItem",
  -- relatedParty from Account
  CASE 
    WHEN t1."Id" IS NOT NULL THEN 
      ARRAY[ROW(
        NULL,
        ROW(
          ROW(t1."Id", ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/party/' || t1."Id"), t1."Name", 'Party'::text, NULL::text, NULL::text, NULL::text)::"tmf"."PartyRef",
          NULL
        )::"tmf"."OneOfPartyRefOrPartyRoleRef",
        NULL::text,
        NULL::text,
        NULL::text
      )::"tmf"."RelatedPartyRefOrPartyRoleRef"]::"tmf"."RelatedPartyRefOrPartyRoleRef"[]
    ELSE NULL::"tmf"."RelatedPartyRefOrPartyRoleRef"[]
  END AS "relatedParty",
  t0."csord__End_Date__c"::timestamp with time zone AS "requestedCompletionDate",
  t0."csord__Start_Date__c"::timestamp with time zone AS "requestedStartDate",
  t0."CreatedDate"::timestamp with time zone AS "creationDate",
  t0."Order_Completed_Date__c"::timestamp with time zone AS "completionDate",
  ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productOrderingManagement/v5/productOrder/' || t0."Id")::text AS "href",
  t0."Id"::text AS "id",
  'ProductOrder'::text AS "@type",
  'Entity'::text AS "@baseType",
  NULL::text AS "@schemaLocation"
FROM "salesforce_server"."csord__Order__c" t0
LEFT JOIN "salesforce_server"."Account" t1 ON t0."csord__Account__c" = t1."Id";

