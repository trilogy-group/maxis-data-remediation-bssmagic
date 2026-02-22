-- Individual View (TMF632) - BSS Magic UI Version
-- Maps: Contact -> individual

DROP VIEW IF EXISTS salesforce_server."individual";
CREATE OR REPLACE VIEW "salesforce_server"."individual" AS
SELECT
    t0."Id"::text AS "id",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/individual/' || t0."Id")::text AS "href",
    t0."FirstName"::text AS "givenName",
    t0."LastName"::text AS "familyName",
    CONCAT(COALESCE(t0."FirstName", ''), ' ', COALESCE(t0."LastName", ''))::text AS "name",
    CONCAT(COALESCE(t0."FirstName", ''), ' ', COALESCE(t0."LastName", ''))::text AS "formattedName",
    t0."Salutation"::text AS "title",
    t0."Birthdate"::timestamp(0) with time zone AS "birthDate",
    t0."Contact_Gender__c"::text AS "gender",
    CASE WHEN t0."Contact_Status__c" = 'Active' THEN 'validated'::"tmf"."IndividualStateType" ELSE 'initialized'::"tmf"."IndividualStateType" END AS "status",
    NULL::text AS "placeOfBirth",
    NULL::text AS "countryOfBirth",
    NULL::text AS "nationality",
    NULL::text AS "maritalStatus",
    NULL::timestamp(0) with time zone AS "deathDate",
    NULL::text AS "aristocraticTitle",
    NULL::text AS "generation",
    NULL::text AS "preferredGivenName",
    NULL::text AS "familyNamePrefix",
    NULL::text AS "legalName",
    NULL::text AS "middleName",
    NULL::text AS "location",
    NULL::"tmf"."OtherNameIndividual"[] AS "otherName",
    NULL::"tmf"."IndividualIdentification"[] AS "individualIdentification",
    NULL::"tmf"."Disability"[] AS "disability",
    NULL::"tmf"."LanguageAbility"[] AS "languageAbility",
    NULL::"tmf"."Skill"[] AS "skill",
    NULL::"tmf"."ExternalIdentifier"[] AS "externalReference",
    NULL::"tmf"."OneOfCharacteristic"[] AS "partyCharacteristic",
    NULL::"tmf"."TaxExemptionCertificate"[] AS "taxExemptionCertificate",
    NULL::"tmf"."PartyCreditProfile"[] AS "creditRating",
    NULL::jsonb[] AS "relatedParty",
    NULL::"tmf"."OneOfContactMedium"[] AS "contactMedium",
    'Individual'::text AS "@type",
    'Party'::text AS "@baseType",
    'https://tmf-open-api.org/TMF632-PartyManagement/v5.0.0'::text AS "@schemaLocation"
FROM "salesforce_server"."Contact" t0
WHERE t0."IsDeleted" = false;


