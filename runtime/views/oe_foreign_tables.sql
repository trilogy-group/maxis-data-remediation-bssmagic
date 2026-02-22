-- =====================================================================
-- REST FDW Foreign Tables for OE Service Remediation (Issue 1867)
-- =====================================================================
-- Creates foreign tables + wrapper views to expose Salesforce
-- Apex REST APIs via PostgreSQL Foreign Data Wrapper.
--
-- ARCHITECTURE:
--   Foreign tables (_ft_ prefix) -> REST FDW -> OAuth -> Salesforce Apex REST
--   Views (no prefix) -> explicit column refs -> foreign tables
--
-- Pattern: identical to rest_foreign_tables.sql (Module 1147)
--
-- Apex REST Endpoints (LLD v2.0 -- base path: /api/v1/migrated-services):
--   GET    /migrated-services/{serviceId}              -> oeServiceInfo (read)
--   PUT    /migrated-services/{serviceId}/attachment    -> oeServiceAttachment (write)
--   POST   /migrated-services/{serviceId}/remediations  -> oeServiceRemediation (write)
--
-- OAuth credentials reuse the existing USER MAPPING on rest_server
-- (created in rest_foreign_tables.sql for Module 1147).
-- =====================================================================

-- Drop existing objects to allow re-application
-- Drop triggers first (depend on views)
DROP TRIGGER IF EXISTS trg_oeServiceAttachment_insert ON salesforce_server."oeServiceAttachment";
DROP TRIGGER IF EXISTS trg_oeServiceRemediation_insert ON salesforce_server."oeServiceRemediation";
-- Drop functions
DROP FUNCTION IF EXISTS salesforce_server._fn_oeServiceAttachment_insert();
DROP FUNCTION IF EXISTS salesforce_server._fn_oeServiceRemediation_insert();
-- Drop views (depend on foreign tables)
DROP VIEW IF EXISTS salesforce_server."oeServiceInfo";
DROP VIEW IF EXISTS salesforce_server."oeServiceAttachment";
DROP VIEW IF EXISTS salesforce_server."oeServiceRemediation";
-- Drop foreign tables
DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_oeServiceInfo";
DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_oeServiceAttachment";
DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_oeServiceRemediation";

-- =============================================================================
-- PostgreSQL composite types for TMF server json_populate_record()
-- TMF server uses PascalCase type names for INSERT/CREATE operations
-- =============================================================================

DROP TYPE IF EXISTS salesforce_server."OeServiceInfo" CASCADE;
CREATE TYPE salesforce_server."OeServiceInfo" AS (
    "id" TEXT,
    "serviceId" TEXT,
    "serviceName" TEXT,
    "productDefinitionName" TEXT,
    "replacementServiceExists" TEXT,
    "attachmentId" TEXT,
    "attachmentContent" TEXT,
    "success" TEXT,
    "message" TEXT,
    "errorCode" TEXT
);

DROP TYPE IF EXISTS salesforce_server."OeServiceAttachment" CASCADE;
CREATE TYPE salesforce_server."OeServiceAttachment" AS (
    "id" TEXT,
    "serviceId" TEXT,
    "attachmentContent" TEXT,
    "attachmentId" TEXT,
    "backupAttachmentId" TEXT,
    "success" TEXT,
    "message" TEXT,
    "errorCode" TEXT
);

DROP TYPE IF EXISTS salesforce_server."OeServiceRemediation" CASCADE;
CREATE TYPE salesforce_server."OeServiceRemediation" AS (
    "id" TEXT,
    "serviceId" TEXT,
    "productDefinitionName" TEXT,
    "remediationId" TEXT,
    "status" TEXT,
    "success" TEXT,
    "message" TEXT,
    "errorCode" TEXT
);

-- Also create in public schema (for psql testing)
DROP TYPE IF EXISTS "OeServiceInfo" CASCADE;
CREATE TYPE "OeServiceInfo" AS (
    "id" TEXT, "serviceId" TEXT, "serviceName" TEXT,
    "productDefinitionName" TEXT, "replacementServiceExists" TEXT,
    "attachmentId" TEXT, "attachmentContent" TEXT,
    "success" TEXT, "message" TEXT, "errorCode" TEXT
);
DROP TYPE IF EXISTS "OeServiceAttachment" CASCADE;
CREATE TYPE "OeServiceAttachment" AS (
    "id" TEXT, "serviceId" TEXT, "attachmentContent" TEXT,
    "attachmentId" TEXT, "backupAttachmentId" TEXT,
    "success" TEXT, "message" TEXT, "errorCode" TEXT
);
DROP TYPE IF EXISTS "OeServiceRemediation" CASCADE;
CREATE TYPE "OeServiceRemediation" AS (
    "id" TEXT, "serviceId" TEXT, "productDefinitionName" TEXT,
    "remediationId" TEXT, "status" TEXT,
    "success" TEXT, "message" TEXT, "errorCode" TEXT
);

-- =============================================================================
-- Ensure USER MAPPING exists for rest_server (OAuth client_credentials)
-- This is needed because the container's PostgreSQL is ephemeral.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_user_mappings WHERE srvname = 'rest_server'
  ) THEN
    EXECUTE $usr$
      CREATE USER MAPPING FOR PUBLIC SERVER rest_server
      OPTIONS (
        grant_type    'client_credentials',
        login_server  'https://your-instance.sandbox.my.salesforce.com/services/oauth2/token',
        client_id     'your_oauth_consumer_key_here',
        client_secret 'your_oauth_consumer_secret_here'
      );
    $usr$;
    RAISE NOTICE 'Created USER MAPPING for rest_server';
  ELSE
    RAISE NOTICE 'USER MAPPING for rest_server already exists';
  END IF;
END $$;

-- =============================================================================
-- 1. oeServiceInfo - Read-only GET /migrated-services/{serviceId}
-- =============================================================================
-- Returns: attachmentContent (full ProductAttributeDetails.json as string),
--          productDefinitionName (PDName via Service -> PC -> PD),
--          replacementServiceExists (boolean as string),
--          attachmentId, serviceName
-- Used by: OE Executor Step 1 (validate + fetch raw data)
-- BSS Magic uses this raw data to determine which attributes need patching.
CREATE FOREIGN TABLE salesforce_server."_ft_oeServiceInfo" (
    "serviceId"                 TEXT,
    "serviceName"               TEXT,
    "productDefinitionName"     TEXT,
    "replacementServiceExists"  TEXT,
    "attachmentId"              TEXT,
    "attachmentContent"         TEXT,
    "success"                   TEXT,
    "message"                   TEXT,
    "errorCode"                 TEXT
) SERVER rest_server
OPTIONS (
    url           'https://maxis--fdrv2.sandbox.my.salesforce.com',
    byid_path     '/services/apexrest/api/v1/migrated-services/{serviceId}',
    id_column     'serviceId',
    byid_result_path '',
    select_method 'GET'
);

-- View wrapper: forces explicit column references for to_jsonb(t.*)
-- "id" alias needed for TMF server path-parameter lookups (WHERE "id" = ...)
CREATE OR REPLACE VIEW salesforce_server."oeServiceInfo" AS
SELECT
    "serviceId" AS "id",
    "serviceId",
    "serviceName",
    "productDefinitionName",
    "replacementServiceExists",
    "attachmentId",
    "attachmentContent",
    "success",
    "message",
    "errorCode"
FROM salesforce_server."_ft_oeServiceInfo";

-- =============================================================================
-- 2. oeServiceAttachment - PUT /migrated-services/{serviceId}/attachment
-- =============================================================================
-- Sends: updated attachmentContent JSON (the patched ProductAttributeDetails.json)
-- Returns: confirmation (success, attachmentId of new, backupAttachmentId of _old)
-- Used by: OE Executor Step 3 (persist patched attachment to Salesforce)
-- Security: restricted to ProductAttributeDetails.json only (Apex enforced)
--
-- Strategy: same as _ft_solutionPostUpdate in rest_foreign_tables.sql
-- FDW update() sends PUT with JSON body from SET values.
-- CRITICAL: attachmentContent must be JSONB so the REST FDW json.loads()
-- the value and sends it as a JSON object in the PUT body. If TEXT, the
-- FDW sends it as a JSON string, but Salesforce expects Map<String,ANY>.
CREATE FOREIGN TABLE salesforce_server."_ft_oeServiceAttachment" (
    "serviceId"           TEXT,
    "attachmentContent"   JSONB,
    "attachmentId"        TEXT,
    "backupAttachmentId"  TEXT,
    "success"             TEXT,
    "message"             TEXT,
    "errorCode"           TEXT
) SERVER rest_server
OPTIONS (
    url            'https://maxis--fdrv2.sandbox.my.salesforce.com',
    byid_path      '/services/apexrest/api/v1/migrated-services/{serviceId}/attachment',
    id_column      'serviceId',
    byid_result_path '',
    update_method  'PUT',
    allow_writes   'true',
    get_before_update 'false',
    stub_select    'true'
);

-- View wrapper with "id" alias
-- attachmentContent cast from JSONB to TEXT for the TMF server composite type
CREATE OR REPLACE VIEW salesforce_server."oeServiceAttachment" AS
SELECT
    "serviceId" AS "id",
    "serviceId",
    "attachmentContent"::TEXT AS "attachmentContent",
    "attachmentId",
    "backupAttachmentId",
    "success",
    "message",
    "errorCode"
FROM salesforce_server."_ft_oeServiceAttachment";

-- INSERT trigger: TMF POST -> FDW UPDATE (which sends PUT to Salesforce)
-- BSS Magic constructs the patched attachmentContent and sends it here.
-- Salesforce Apex handles: backup old -> delete -> create new.
-- The TEXT -> JSONB cast ensures the FDW sends it as a JSON object.
CREATE OR REPLACE FUNCTION salesforce_server._fn_oeServiceAttachment_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE salesforce_server."_ft_oeServiceAttachment"
    SET "attachmentContent" = NEW."attachmentContent"::jsonb
    WHERE "serviceId" = NEW."serviceId";

    NEW."success" := 'true';
    NEW."message" := 'Attachment updated via PUT';
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    NEW."success" := 'false';
    NEW."message" := SQLERRM;
    NEW."errorCode" := 'ATTACHMENT_UPDATE_FAILED';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_oeServiceAttachment_insert
    INSTEAD OF INSERT ON salesforce_server."oeServiceAttachment"
    FOR EACH ROW EXECUTE FUNCTION salesforce_server._fn_oeServiceAttachment_insert();

-- =============================================================================
-- 3. oeServiceRemediation - POST /migrated-services/{serviceId}/remediations
-- =============================================================================
-- Sends: productDefinitionName (Apex uses it to identify the OE component
--        and calls cssmgnt.API_1.updateOEData() internally)
-- Returns: remediationId (tracking reference), status (COMPLETED/FAILED)
-- Used by: OE Executor Step 4 (trigger SM Service sync)
-- Idempotency: supports Idempotency-Key HTTP header
--
-- Strategy: use update_method='POST' so FDW update() sends a POST with
-- a JSON body (containing productDefinitionName). The select_method='POST'
-- approach doesn't work because _make_request only sends URL params, no body.
CREATE FOREIGN TABLE salesforce_server."_ft_oeServiceRemediation" (
    "serviceId"              TEXT,
    "productDefinitionName"  TEXT,
    "remediationId"          TEXT,
    "status"                 TEXT,
    "success"                TEXT,
    "message"                TEXT,
    "errorCode"              TEXT
) SERVER rest_server
OPTIONS (
    url            'https://maxis--fdrv2.sandbox.my.salesforce.com',
    byid_path      '/services/apexrest/api/v1/migrated-services/{serviceId}/remediations',
    id_column      'serviceId',
    byid_result_path '',
    update_method  'POST',
    allow_writes   'true',
    get_before_update 'false',
    stub_select    'true'
);

-- View wrapper with "id" alias
CREATE OR REPLACE VIEW salesforce_server."oeServiceRemediation" AS
SELECT
    "serviceId" AS "id",
    "serviceId",
    "productDefinitionName",
    "remediationId",
    "status",
    "success",
    "message",
    "errorCode"
FROM salesforce_server."_ft_oeServiceRemediation";

-- INSERT trigger: TMF POST -> FDW UPDATE with POST method
-- FDW update() sends POST with JSON body {productDefinitionName: "Voice"}
-- to /migrated-services/{serviceId}/remediations
CREATE OR REPLACE FUNCTION salesforce_server._fn_oeServiceRemediation_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE salesforce_server."_ft_oeServiceRemediation"
    SET "productDefinitionName" = COALESCE(NEW."productDefinitionName", 'Voice')
    WHERE "serviceId" = NEW."serviceId";

    NEW."success" := 'true';
    NEW."message" := 'Remediation triggered via POST';
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    NEW."success" := 'false';
    NEW."message" := SQLERRM;
    NEW."errorCode" := 'REMEDIATION_FAILED';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_oeServiceRemediation_insert
    INSTEAD OF INSERT ON salesforce_server."oeServiceRemediation"
    FOR EACH ROW EXECUTE FUNCTION salesforce_server._fn_oeServiceRemediation_insert();
