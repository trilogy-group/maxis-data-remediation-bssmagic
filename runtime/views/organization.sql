-- Organization View (TMF632)
-- Source: Account
-- Endpoint: /tmf-api/partyManagement/v5/organization
--
-- Maps Salesforce Account to TMF632 Organization
-- Used by relatedParty[customer] in Product view

DROP VIEW IF EXISTS salesforce_server."organization";
CREATE VIEW salesforce_server."organization" AS
SELECT
    t0."Id"::text AS "id",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/partyManagement/v5/organization/' || t0."Id")::text AS "href",
    t0."Name"::text AS "name",
    t0."Name"::text AS "tradingName",
    t0."Type"::text AS "organizationType",
    -- Status: OrganizationStateType enum (initialized, validated, closed)
    'validated'::tmf."OrganizationStateType" AS "status",
    -- External Reference (AccountNumber) - note: field is externalReference, not externalIdentifier
    CASE WHEN t0."AccountNumber" IS NOT NULL THEN
        ARRAY[
            ROW(
                NULL::text,                                -- externalIdentifierType
                t0."AccountNumber"::text,                  -- id
                NULL::text,                                -- owner
                NULL::tmf."TimePeriod",                    -- validFor
                'ExternalIdentifier'::text,                -- @type
                NULL::text                                 -- @schemaLocation
            )::tmf."ExternalIdentifier"
        ]::tmf."ExternalIdentifier"[]
    ELSE NULL::tmf."ExternalIdentifier"[]
    END AS "externalReference",
    -- TMF fields
    'Organization'::text AS "@type",
    'Party'::text AS "@baseType",
    'https://tmf-open-api.org/TMF632-PartyManagement/v5.0.0'::text AS "@schemaLocation"
FROM salesforce_server."Account" t0;
