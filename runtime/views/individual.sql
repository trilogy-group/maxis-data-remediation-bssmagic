-- Individual View (TMF632)
-- Maps: Contact -> individual
-- Includes relatedParty with:
--   - account (Account/Organization)
--   - creator (CreatedBy/User)

DROP VIEW IF EXISTS salesforce_server."individual";
CREATE VIEW salesforce_server."individual" AS
SELECT
    NULL::text AS "gender",
    NULL::text AS "placeOfBirth",
    NULL::text AS "countryOfBirth",
    NULL::text AS "nationality",
    NULL::text AS "maritalStatus",
    NULL::date AS "birthDate",
    NULL::date AS "deathDate",
    NULL::text AS "title",
    NULL::text AS "aristocraticTitle",
    NULL::text AS "generation",
    NULL::text AS "preferredGivenName",
    NULL::text AS "familyNamePrefix",
    NULL::text AS "legalName",
    NULL::text AS "middleName",
    t0."Name"::text AS "name",
    t0."Name"::text AS "formattedName",
    NULL::text AS "location",
    NULL::text AS "status",
    NULL::jsonb[] AS "otherName",
    NULL::jsonb[] AS "individualIdentification",
    NULL::jsonb[] AS "disability",
    NULL::jsonb[] AS "languageAbility",
    NULL::jsonb AS "skill",
    t0."LastName"::text AS "familyName",
    t0."FirstName"::text AS "givenName",
    NULL::jsonb[] AS "externalReference",
    NULL::jsonb[] AS "partyCharacteristic",
    NULL::jsonb[] AS "taxExemptionCertificate",
    NULL::jsonb[] AS "creditRating",
    -- relatedParty with Account and CreatedBy
    ARRAY_REMOVE(ARRAY[
        -- Account (Organization)
        CASE WHEN t0."AccountId" IS NOT NULL THEN
            ROW(
                'account'::text,
                ROW(
                    ROW(
                        t0."AccountId"::text,
                        ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/organization/' || t0."AccountId")::text,
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
        -- Creator (User)
        CASE WHEN t0."CreatedById" IS NOT NULL THEN
            ROW(
                'creator'::text,
                ROW(
                    ROW(
                        t0."CreatedById"::text,
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
    ], NULL)::"tmf"."RelatedPartyRefOrPartyRoleRef"[] AS "relatedParty",
    -- contactMedium: Email from Contact
    CASE WHEN t0."Email" IS NOT NULL THEN
        ARRAY[
            ROW(
                NULL::"tmf"."ContactMedium",
                ROW(
                    t0."Email"::text,  -- emailAddress
                    NULL::text,  -- id
                    NULL::boolean,  -- preferred
                    'email'::text,  -- contactType
                    NULL::"tmf"."TimePeriod",  -- validFor
                    'EmailContactMedium'::text,  -- @type
                    'ContactMedium'::text,  -- @baseType
                    NULL::text  -- @schemaLocation
                )::"tmf"."EmailContactMedium",
                NULL::"tmf"."FaxContactMedium",
                NULL::"tmf"."GeographicAddressContactMedium",
                NULL::"tmf"."PhoneContactMedium",
                NULL::"tmf"."SocialContactMedium"
            )::"tmf"."OneOfContactMedium"
        ]::"tmf"."OneOfContactMedium"[]
    ELSE NULL::"tmf"."OneOfContactMedium"[]
    END AS "contactMedium",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/individual/' || t0."Id")::text AS href,
    t0."Id"::text AS id,
    'Individual'::text AS "@type",
    'Entity'::text AS "@baseType",
    NULL::text AS "@schemaLocation"
FROM salesforce_server."Contact" t0;
