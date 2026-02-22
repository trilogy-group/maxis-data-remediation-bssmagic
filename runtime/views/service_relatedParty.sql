-- =====================================================================
-- Service View (TMF638) - WITH relatedParty (NO JOINs)
-- =====================================================================
-- Maps: csord__Service__c -> service
-- 
-- relatedParty includes:
--   ✅ Customer (Account) - from Account__c
--   ✅ Billing Account - from Billing_Account__c (ID only, no name)
--
-- NO JOINs - All fields direct from csord__Service__c
-- To get Billing Account details (Name, Contact), call /billingAccount API
-- =====================================================================

DROP VIEW IF EXISTS salesforce_server."service";
CREATE VIEW salesforce_server."service" AS
SELECT
    -- Core TMF Service fields
    svc."Id"::text AS id,
    svc."Name"::text AS "name",
    svc."Service_Type__c"::text AS "serviceType",
    svc."csord__Status__c"::text AS "state",
    svc."CreatedDate"::timestamp with time zone AS "startDate",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceInventoryManagement/v5/service/' || svc."Id")::text AS href,
    'Service'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation",
    
    -- relatedParty: Customer + Billing Account (both direct fields, NO JOINs)
    CASE 
        WHEN svc."Account__c" IS NOT NULL AND svc."Billing_Account__c" IS NOT NULL THEN
            -- Both Account and Billing Account
            ARRAY[
                -- Customer (Account/Organization)
                ROW(
                    'customer'::text,
                    ROW(
                        ROW(
                            svc."Account__c"::text,
                            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/organization/' || svc."Account__c")::text,
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
                )::tmf."RelatedPartyOrPartyRole",
                -- Billing Account (PartyRoleRef)
                ROW(
                    'billingAccount'::text,
                    ROW(
                        NULL::tmf."PartyRef",
                        ROW(
                            NULL::text,
                            NULL::text,
                            svc."Billing_Account__c"::text,
                            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/accountManagement/v5/billingAccount/' || svc."Billing_Account__c")::text,
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
            ]::tmf."RelatedPartyOrPartyRole"[]
        WHEN svc."Account__c" IS NOT NULL THEN
            -- Only Account
            ARRAY[
                ROW(
                    'customer'::text,
                    ROW(
                        ROW(
                            svc."Account__c"::text,
                            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/organization/' || svc."Account__c")::text,
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
            ]::tmf."RelatedPartyOrPartyRole"[]
        WHEN svc."Billing_Account__c" IS NOT NULL THEN
            -- Only Billing Account
            ARRAY[
                ROW(
                    'billingAccount'::text,
                    ROW(
                        NULL::tmf."PartyRef",
                        ROW(
                            NULL::text,
                            NULL::text,
                            svc."Billing_Account__c"::text,
                            ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/accountManagement/v5/billingAccount/' || svc."Billing_Account__c")::text,
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
            ]::tmf."RelatedPartyOrPartyRole"[]
        ELSE NULL::tmf."RelatedPartyOrPartyRole"[]
    END AS "relatedParty",
    
    -- Custom fields for 1867 detection (all direct - NO JOINs)
    svc."Service_Type__c"::text AS "x_serviceType",
    svc."External_ID__c"::text AS "x_externalId",
    svc."Billing_Account__c"::text AS "x_billingAccountId",
    svc."cssdm__solution_association__c"::text AS "x_solutionId",
    svc."csord__Subscription__c"::text AS "x_subscriptionId",
    svc."Account__c"::text AS "x_accountId",
    svc."Migrated_Data__c"::boolean AS "x_migratedData",
    svc."Migrated_To_Heroku__c"::boolean AS "x_migratedToHeroku",
    
    -- 1867 Detection flag
    CASE 
        WHEN svc."Migrated_Data__c" = true 
        AND svc."Service_Type__c" IN ('Voice', 'Fibre Service', 'eSMS Service', 'Access Service') 
        THEN true ELSE false 
    END::boolean AS "x_has1867Issue"
    
FROM salesforce_server."csord__Service__c" svc;
