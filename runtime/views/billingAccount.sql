-- TMF BillingAccount View
-- Maps csconta__Billing_Account__c to TMF BillingAccount
-- Includes relatedParty with:
--   - customer (Account/Organization)
--   - contact (Contact/Individual) - for PIC Email lookup chain
--   - creator (CreatedBy/User)

DROP VIEW IF EXISTS salesforce_server."billingAccount" CASCADE;

CREATE VIEW salesforce_server."billingAccount" AS
SELECT
    ba."Id"::text AS id,
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/accountManagement/v5/billingAccount/' || ba."Id")::text AS href,
    ba."Name"::text AS name,  -- BA sequence (Auto Number like "BA-0140269")
    ba."csconta__Status__c"::text AS state,
    ba."Billing_Account_Type__c"::text AS "accountType",
    ba."Account_Payment_Type__c"::text AS "paymentStatus",
    ba."LastModifiedDate"::timestamp with time zone AS "lastUpdate",
    -- relatedParty with Account (customer), Contact (contact), and CreatedBy (creator)
    ARRAY_REMOVE(ARRAY[
        -- Customer (Organization/Account)
        CASE WHEN ba."csconta__Account__c" IS NOT NULL THEN
            ROW(
                'customer'::text,
                ROW(
                    ROW(
                        ba."csconta__Account__c"::text,
                        ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/organization/' || ba."csconta__Account__c")::text,
                        NULL::text,
                        'Organization'::text,
                        'PartyRef'::text,
                        NULL::text,
                        NULL::text
                    )::"tmf"."PartyRef",
                    NULL::"tmf"."PartyRoleRef"
                )::"tmf"."OneOfPartyRefOrPartyRoleRef",
                NULL::text,
                NULL::text,
                NULL::text
            )::"tmf"."RelatedPartyRefOrPartyRoleRef"
        ELSE NULL END,
        -- Contact (Individual) - for PIC Email lookup
        CASE WHEN ba."Contact__c" IS NOT NULL THEN
            ROW(
                'contact'::text,
                ROW(
                    ROW(
                        ba."Contact__c"::text,
                        ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/individual/' || ba."Contact__c")::text,
                        NULL::text,
                        'Individual'::text,
                        'PartyRef'::text,
                        NULL::text,
                        NULL::text
                    )::"tmf"."PartyRef",
                    NULL::"tmf"."PartyRoleRef"
                )::"tmf"."OneOfPartyRefOrPartyRoleRef",
                NULL::text,
                NULL::text,
                NULL::text
            )::"tmf"."RelatedPartyRefOrPartyRoleRef"
        ELSE NULL END,
        -- Creator (User) - CreatedById
        CASE WHEN ba."CreatedById" IS NOT NULL THEN
            ROW(
                'creator'::text,
                ROW(
                    ROW(
                        ba."CreatedById"::text,
                        NULL::text,
                        NULL::text,
                        'User'::text,
                        'PartyRef'::text,
                        NULL::text,
                        NULL::text
                    )::"tmf"."PartyRef",
                    NULL::"tmf"."PartyRoleRef"
                )::"tmf"."OneOfPartyRefOrPartyRoleRef",
                NULL::text,
                NULL::text,
                NULL::text
            )::"tmf"."RelatedPartyRefOrPartyRoleRef"
        ELSE NULL END
    ], NULL) AS "relatedParty",
    'BillingAccount'::text AS "@type",
    'PartyAccount'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM salesforce_server."csconta__Billing_Account__c" ba;
