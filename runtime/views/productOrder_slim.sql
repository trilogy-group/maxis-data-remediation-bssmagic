-- ProductOrder View (TMF622) - SLIM VERSION
-- Maps: csord__Order__c -> productOrder
-- NO JOINs to avoid FDW rate limiting
--
-- Removed: Account JOIN for relatedParty (query separately)

DROP VIEW IF EXISTS salesforce_server."productOrder";
CREATE VIEW salesforce_server."productOrder" AS
SELECT
    NULL::tmf."AgreementRef"[] AS "agreement",
    NULL::tmf."BillingAccountRef" AS "billingAccount",
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
    NULL::tmf."InitialProductOrderStateType" AS "requestedInitialState",
    NULL::timestamp(0) with time zone AS "cancellationDate",
    NULL::text AS "cancellationReason",
    COALESCE(t0."csord__Order_Type__c", 'standard')::text AS "category",
    NULL::tmf."RelatedChannel"[] AS "channel",
    t0."Comments__c"::text AS "description",
    t0."csord__End_Date__c"::timestamp(0) with time zone AS "expectedCompletionDate",
    CASE WHEN t0."csord__Customer_Order_Number__c" IS NOT NULL THEN
        ARRAY[
            ROW(NULL, 'CustomerOrderNumber', t0."csord__Customer_Order_Number__c", NULL, NULL, NULL)::tmf."ExternalIdentifier",
            ROW(NULL, 'OrderNumber', COALESCE(t0."csord__Order_Number__c", t0."Name"), NULL, NULL, NULL)::tmf."ExternalIdentifier"
        ]::tmf."ExternalIdentifier"[]
    ELSE
        ARRAY[
            ROW(NULL, 'OrderNumber', COALESCE(t0."csord__Order_Number__c", t0."Name"), NULL, NULL, NULL)::tmf."ExternalIdentifier"
        ]::tmf."ExternalIdentifier"[]
    END AS "externalId",
    NULL::tmf."Note"[] AS "note",
    NULL::text AS "notificationContact",
    NULL::tmf."OrderPrice"[] AS "orderTotalPrice",
    NULL::tmf."PaymentRef"[] AS "payment",
    NULL::tmf."OrderRelationship"[] AS "orderRelationship",
    'normal'::text AS "priority",
    NULL::tmf."ProductOfferingQualificationRef"[] AS "productOfferingQualification",
    NULL::tmf."QuoteRef"[] AS "quote",
    NULL::tmf."ProductOrderErrorMessage"[] AS "productOrderErrorMessage",
    NULL::tmf."ProductOrderJeopardyAlert"[] AS "productOrderJeopardyAlert",
    NULL::tmf."ProductOrderMilestone"[] AS "productOrderMilestone",
    NULL::tmf."ProductOrderItem"[] AS "productOrderItem",
    -- relatedParty: Account ID only (no JOIN to get name)
    CASE WHEN t0."csord__Account__c" IS NOT NULL THEN
        ARRAY[
            ROW(
                NULL,
                ROW(
                    ROW(
                        t0."csord__Account__c"::text,
                        ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/organization/' || t0."csord__Account__c")::text,
                        NULL::text,  -- name NULL to avoid JOIN
                        'Organization'::text,
                        'PartyRef'::text,
                        NULL::text,
                        NULL::text
                    )::tmf."PartyRef",
                    NULL
                )::tmf."OneOfPartyRefOrPartyRoleRef",
                NULL::text,
                NULL::text,
                NULL::text
            )::tmf."RelatedPartyRefOrPartyRoleRef"
        ]::tmf."RelatedPartyRefOrPartyRoleRef"[]
    ELSE NULL::tmf."RelatedPartyRefOrPartyRoleRef"[]
    END AS "relatedParty",
    t0."csord__End_Date__c"::timestamp(0) with time zone AS "requestedCompletionDate",
    t0."csord__Start_Date__c"::timestamp(0) with time zone AS "requestedStartDate",
    t0."CreatedDate"::timestamp(0) with time zone AS "creationDate",
    t0."Order_Completed_Date__c"::timestamp(0) with time zone AS "completionDate",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/productOrderingManagement/v5/productOrder/' || t0."Id")::text AS "href",
    t0."Id"::text AS "id",
    'ProductOrder'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM salesforce_server."csord__Order__c" t0
WHERE t0."Id" IS NOT NULL;
