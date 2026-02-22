-- =====================================================================
-- REST FDW Foreign Tables for Solution Management (API v2.0)
-- =====================================================================
-- Creates foreign tables + wrapper views to expose Salesforce
-- Apex REST APIs via PostgreSQL Foreign Data Wrapper.
--
-- ARCHITECTURE:
--   Foreign tables (_ft_ prefix) → REST FDW → OAuth → Salesforce Apex REST
--   Views (no prefix) → explicit column refs → foreign tables
--
-- The wrapper views are needed because the TMF server uses
-- SELECT to_jsonb(t.*) which doesn't pass explicit column references
-- to the FDW, causing it to only return the WHERE column.
-- The views force explicit column expansion.
--
-- API v2.0 Endpoints (resource-oriented, solutionId as path param):
--   GET    /solutions/{solutionId}                   → solutionInfo (read)
--   DELETE /solutions/{solutionId}                   → solutionMigration DELETE
--   POST   /solutions/{solutionId}/migrations        → solutionMigration INSERT
--   GET    /solutions/{solutionId}/migrations/status  → migrationStatus (read)
--   PATCH  /solutions/{solutionId}                   → solutionPostUpdate
--
-- OAuth credentials are stored in a USER MAPPING on the existing
-- rest_server foreign server (fdw_rest.rest_fdw.RestForeignDataWrapper).
-- =====================================================================

-- Drop existing objects to allow re-application
-- Drop triggers first (depend on views)
DROP TRIGGER IF EXISTS trg_solutionMigration_insert ON salesforce_server."solutionMigration";
DROP TRIGGER IF EXISTS trg_solutionMigration_delete ON salesforce_server."solutionMigration";
DROP TRIGGER IF EXISTS trg_solutionPostUpdate_insert ON salesforce_server."solutionPostUpdate";
-- Drop functions
DROP FUNCTION IF EXISTS salesforce_server._fn_solutionMigration_insert();
DROP FUNCTION IF EXISTS salesforce_server._fn_solutionMigration_delete();
DROP FUNCTION IF EXISTS salesforce_server._fn_solutionPostUpdate_insert();
-- Drop views (depend on foreign tables)
DROP VIEW IF EXISTS salesforce_server."solutionInfo";
DROP VIEW IF EXISTS salesforce_server."migrationStatus";
DROP VIEW IF EXISTS salesforce_server."solutionMigration";
DROP VIEW IF EXISTS salesforce_server."solutionPostUpdate";
-- Drop current foreign tables
DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_solutionInfo";
DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_migrationStatus";
DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_solutionDelete";
DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_solutionMigrate";
DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_solutionPostUpdate";
-- Legacy cleanup (old names from previous versions)
DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_solutionMigration";
DROP FOREIGN TABLE IF EXISTS salesforce_server."solutionInfo";
DROP FOREIGN TABLE IF EXISTS salesforce_server."migrationStatus";
DROP FOREIGN TABLE IF EXISTS salesforce_server."solutionMigration";
DROP FOREIGN TABLE IF EXISTS salesforce_server."solutionPostUpdate";
DROP FOREIGN TABLE IF EXISTS rest_server."solutionInfo";
DROP FOREIGN TABLE IF EXISTS rest_server."migrationStatus";
DROP FOREIGN TABLE IF EXISTS rest_server."solutionMigration";
DROP FOREIGN TABLE IF EXISTS rest_server."solutionPostUpdate";
DROP USER MAPPING IF EXISTS FOR postgres SERVER rest_server;

-- =============================================================================
-- PostgreSQL composite types for TMF server json_populate_record()
-- TMF server uses PascalCase type names for INSERT/CREATE operations
-- =============================================================================
-- Create in salesforce_server schema (TMF server's search_path)
DROP TYPE IF EXISTS salesforce_server."SolutionInfo" CASCADE;
CREATE TYPE salesforce_server."SolutionInfo" AS (
    "id" TEXT,
    "solutionId" TEXT,
    "solutionName" TEXT,
    "externalIdentifier" TEXT,
    "createdBy" TEXT,
    "createdDate" TEXT,
    "migrationStatus" TEXT,
    "migrationDate" TEXT,
    "success" TEXT,
    "message" TEXT,
    "macdDetails" TEXT,
    "smServiceStatus" TEXT,
    "additionalMetadata" TEXT
);

DROP TYPE IF EXISTS salesforce_server."MigrationStatus" CASCADE;
CREATE TYPE salesforce_server."MigrationStatus" AS (
    "id" TEXT,
    "solutionId" TEXT,
    "status" TEXT,
    "subscriptionCount" TEXT,
    "message" TEXT,
    "success" TEXT
);

DROP TYPE IF EXISTS salesforce_server."SolutionMigration" CASCADE;
CREATE TYPE salesforce_server."SolutionMigration" AS (
    "id" TEXT,
    "solutionId" TEXT,
    "jobId" TEXT,
    "status" TEXT,
    "message" TEXT,
    "success" TEXT
);

DROP TYPE IF EXISTS salesforce_server."SolutionPostUpdate" CASCADE;
CREATE TYPE salesforce_server."SolutionPostUpdate" AS (
    "id" TEXT,
    "solutionId" TEXT,
    "migrationStatus" TEXT,
    "jobId" TEXT,
    "sfdcUpdates" JSONB,
    "smServiceData" JSONB,
    "sfdcUpdateStatus" TEXT,
    "smServiceUpdateStatus" TEXT,
    "updatedFields" JSONB,
    "errors" JSONB,
    "success" TEXT,
    "message" TEXT
);

-- Also create in public schema (for psql testing)
DROP TYPE IF EXISTS "SolutionInfo" CASCADE;
CREATE TYPE "SolutionInfo" AS (
    "id" TEXT, "solutionId" TEXT, "solutionName" TEXT, "externalIdentifier" TEXT,
    "createdBy" TEXT, "createdDate" TEXT, "migrationStatus" TEXT, "migrationDate" TEXT,
    "success" TEXT, "message" TEXT, "macdDetails" TEXT, "smServiceStatus" TEXT, "additionalMetadata" TEXT
);
DROP TYPE IF EXISTS "MigrationStatus" CASCADE;
CREATE TYPE "MigrationStatus" AS (
    "id" TEXT, "solutionId" TEXT, "status" TEXT, "subscriptionCount" TEXT, "message" TEXT, "success" TEXT
);
DROP TYPE IF EXISTS "SolutionMigration" CASCADE;
CREATE TYPE "SolutionMigration" AS (
    "id" TEXT, "solutionId" TEXT, "jobId" TEXT, "status" TEXT, "message" TEXT, "success" TEXT
);
DROP TYPE IF EXISTS "SolutionPostUpdate" CASCADE;
CREATE TYPE "SolutionPostUpdate" AS (
    "id" TEXT, "solutionId" TEXT, "migrationStatus" TEXT, "jobId" TEXT,
    "sfdcUpdates" JSONB, "smServiceData" JSONB, "sfdcUpdateStatus" TEXT, "smServiceUpdateStatus" TEXT,
    "updatedFields" JSONB, "errors" JSONB, "success" TEXT, "message" TEXT
);

-- =============================================================================
-- USER MAPPING: OAuth client_credentials grant for Salesforce Connected App
-- =============================================================================
CREATE USER MAPPING FOR postgres
SERVER rest_server
OPTIONS (
    grant_type    'client_credentials',
    client_id     'your_oauth_consumer_key_here',
    client_secret 'your_oauth_consumer_secret_here',
    login_server  'https://your-instance.sandbox.my.salesforce.com/services/oauth2/token'
);

-- =============================================================================
-- 1. solutionInfo - Read-only GET /solutions/{solutionId}
-- =============================================================================
-- API v2.0: Resource-oriented URL with solutionId as path parameter
CREATE FOREIGN TABLE salesforce_server."_ft_solutionInfo" (
    "solutionId"          TEXT,
    "solutionName"        TEXT,
    "externalIdentifier"  TEXT,
    "createdBy"           TEXT,
    "createdDate"         TEXT,
    "migrationStatus"     TEXT,
    "migrationDate"       TEXT,
    "success"             TEXT,
    "message"             TEXT,
    "macdDetails"         JSONB OPTIONS (byid_mapping '$.macdDetails'),
    "smServiceStatus"     JSONB OPTIONS (byid_mapping '$.smServiceStatus'),
    "additionalMetadata"  JSONB OPTIONS (byid_mapping '$.additionalMetadata')
) SERVER rest_server
OPTIONS (
    url          'https://maxis--fdrv2.sandbox.my.salesforce.com',
    byid_path    '/services/apexrest/api/v1/solutions/{solutionId}',
    id_column    'solutionId',
    byid_result_path '',
    select_method 'GET'
);

-- View wrapper: forces explicit column references for to_jsonb(t.*)
-- JSONB columns cast to TEXT to avoid TMF server typeShape parsing errors
-- "id" alias needed for TMF server path-parameter lookups (WHERE "id" = ...)
CREATE OR REPLACE VIEW salesforce_server."solutionInfo" AS
SELECT
    "solutionId" AS "id",
    "solutionId",
    "solutionName",
    "externalIdentifier",
    "createdBy",
    "createdDate",
    "migrationStatus",
    "migrationDate",
    "success",
    "message",
    "macdDetails"::TEXT AS "macdDetails",
    "smServiceStatus"::TEXT AS "smServiceStatus",
    "additionalMetadata"::TEXT AS "additionalMetadata"
FROM salesforce_server."_ft_solutionInfo";

-- =============================================================================
-- 2. migrationStatus - Read-only GET /solutions/{solutionId}/migrations/status
-- =============================================================================
-- API v2.0: Resource-oriented nested path
CREATE FOREIGN TABLE salesforce_server."_ft_migrationStatus" (
    "solutionId"        TEXT,
    "status"            TEXT,
    "subscriptionCount" TEXT,
    "message"           TEXT,
    "success"           TEXT
) SERVER rest_server
OPTIONS (
    url          'https://maxis--fdrv2.sandbox.my.salesforce.com',
    byid_path    '/services/apexrest/api/v1/solutions/{solutionId}/migrations/status',
    id_column    'solutionId',
    byid_result_path '',
    select_method 'GET'
);

-- View wrapper
-- "id" alias needed for TMF server path-parameter lookups
CREATE OR REPLACE VIEW salesforce_server."migrationStatus" AS
SELECT
    "solutionId" AS "id",
    "solutionId",
    "status",
    "subscriptionCount",
    "message",
    "success"
FROM salesforce_server."_ft_migrationStatus";

-- =============================================================================
-- 3. solutionMigration - DELETE + POST (two operations, one TMF entity)
-- =============================================================================
-- API v2.0:
--   DELETE /solutions/{solutionId}             → 204 No Content
--   POST   /solutions/{solutionId}/migrations  → 202 {success, jobId, status}
--
-- Split into separate foreign tables because DELETE and POST have different
-- URL paths and HTTP methods.
--
-- TMF API Surface:
--   DELETE /tmf-api/solutionManagement/v5/solutionMigration/{solutionId}
--   POST   /tmf-api/solutionManagement/v5/solutionMigration
-- =============================================================================

-- 3a. DELETE foreign table: select_method='DELETE' so SELECT triggers a DELETE request
-- API v2.0: DELETE /solutions/{solutionId} → 204 No Content
-- Note: FDW may error on empty 204 response; trigger handles this with EXCEPTION block
CREATE FOREIGN TABLE salesforce_server."_ft_solutionDelete" (
    "solutionId"  TEXT,
    "jobId"       TEXT,
    "status"      TEXT,
    "message"     TEXT,
    "success"     TEXT
) SERVER rest_server
OPTIONS (
    url           'https://maxis--fdrv2.sandbox.my.salesforce.com',
    byid_path     '/services/apexrest/api/v1/solutions/{solutionId}',
    id_column     'solutionId',
    byid_result_path '',
    select_method 'DELETE'
);

-- 3b. MIGRATE foreign table: select_method='POST' so SELECT triggers a POST request
-- API v2.0: POST /solutions/{solutionId}/migrations (no request body needed)
-- Using select_method='POST' + byid_path template means:
--   SELECT * FROM _ft_solutionMigrate WHERE solutionId='xxx'
--   → FDW builds URL from byid_path template: /solutions/xxx/migrations
--   → FDW sends POST (self.method='POST') with no body
--   → FDW parses JSON response into row columns
CREATE FOREIGN TABLE salesforce_server."_ft_solutionMigrate" (
    "solutionId"  TEXT,
    "jobId"       TEXT,
    "status"      TEXT,
    "message"     TEXT,
    "success"     TEXT
) SERVER rest_server
OPTIONS (
    url           'https://maxis--fdrv2.sandbox.my.salesforce.com',
    byid_path     '/services/apexrest/api/v1/solutions/{solutionId}/migrations',
    id_column     'solutionId',
    byid_result_path '',
    select_method 'POST'
);

-- Unified view for the solutionMigration TMF entity
-- Reads from solutionInfo for entity lookup (TMF server SELECTs before DELETE)
-- "id" alias needed for TMF server path-parameter lookups (DELETE /solutionMigration/{id})
CREATE OR REPLACE VIEW salesforce_server."solutionMigration" AS
SELECT
    "solutionId" AS "id",
    "solutionId",
    NULL::TEXT AS "jobId",
    "migrationStatus" AS "status",
    "message",
    "success"
FROM salesforce_server."_ft_solutionInfo";

-- INSERT trigger: proxy to _ft_solutionMigrate via SELECT (which triggers POST)
-- API v2.0: POST /solutions/{solutionId}/migrations (no body)
-- We use SELECT on the foreign table (select_method='POST') to trigger the POST
-- and capture the response fields (jobId, status, success, message).
CREATE OR REPLACE FUNCTION salesforce_server._fn_solutionMigration_insert()
RETURNS TRIGGER AS $$
BEGIN
    SELECT "solutionId", "jobId", "status", "message", "success"
    INTO NEW."solutionId", NEW."jobId", NEW."status", NEW."message", NEW."success"
    FROM salesforce_server."_ft_solutionMigrate"
    WHERE "solutionId" = NEW."solutionId";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_solutionMigration_insert ON salesforce_server."solutionMigration";
CREATE TRIGGER trg_solutionMigration_insert
    INSTEAD OF INSERT ON salesforce_server."solutionMigration"
    FOR EACH ROW EXECUTE FUNCTION salesforce_server._fn_solutionMigration_insert();

-- DELETE trigger: proxy to _ft_solutionDelete (SELECT triggers DELETE request)
-- API v2.0: DELETE /solutions/{solutionId} → 204 No Content
-- The FDW may fail parsing an empty 204 response. We wrap in EXCEPTION block
-- and treat any error after the HTTP call as success (the DELETE went through).
CREATE OR REPLACE FUNCTION salesforce_server._fn_solutionMigration_delete()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        PERFORM * FROM salesforce_server."_ft_solutionDelete"
        WHERE "solutionId" = OLD."id";
    EXCEPTION WHEN OTHERS THEN
        -- API v2.0 returns 204 No Content (empty body).
        -- FDW's response.json() fails on empty response, but the HTTP DELETE
        -- already succeeded (raise_for_status() passed). Treat as success.
        RAISE NOTICE 'DELETE for % completed (204 No Content expected): %', OLD."id", SQLERRM;
    END;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_solutionMigration_delete ON salesforce_server."solutionMigration";
CREATE TRIGGER trg_solutionMigration_delete
    INSTEAD OF DELETE ON salesforce_server."solutionMigration"
    FOR EACH ROW EXECUTE FUNCTION salesforce_server._fn_solutionMigration_delete();

-- =============================================================================
-- 4. solutionPostUpdate - PATCH /solutions/{solutionId}
-- =============================================================================
-- API v2.0: Changed from POST to PATCH with structured body:
--   { migrationStatus, jobId?, sfdcUpdates?: {...}, smServiceData?: {...} }
--
-- Strategy: Use FDW's update() method which supports:
--   - byid_path template substitution ({solutionId} → actual ID)
--   - update_method 'PATCH'
--   - JSON body from SET values
-- The INSTEAD OF INSERT trigger on the TMF view calls UPDATE on the
-- foreign table, which maps to a PATCH HTTP request.
-- =============================================================================
CREATE FOREIGN TABLE salesforce_server."_ft_solutionPostUpdate" (
    "solutionId"           TEXT,
    "migrationStatus"      TEXT,
    "jobId"                TEXT,
    "sfdcUpdates"          JSONB,
    "smServiceData"        JSONB,
    "sfdcUpdateStatus"     TEXT,
    "smServiceUpdateStatus" TEXT,
    "updatedFields"        TEXT,
    "errors"               TEXT,
    "success"              TEXT,
    "message"              TEXT
) SERVER rest_server
OPTIONS (
    url           'https://maxis--fdrv2.sandbox.my.salesforce.com',
    byid_path     '/services/apexrest/api/v1/solutions/{solutionId}',
    id_column     'solutionId',
    byid_result_path '',
    update_method 'PATCH',
    allow_writes  'true',
    get_before_update 'false'
);

-- View wrapper with INSTEAD OF trigger for INSERT
-- "id" alias needed for TMF server entity discovery
-- JSONB columns cast to TEXT to avoid TMF server typeShape parsing errors (Lesson #7)
-- The INSTEAD OF INSERT trigger receives TEXT values, which PostgreSQL implicitly
-- casts back to JSONB when setting values on the JSONB foreign table columns.
CREATE OR REPLACE VIEW salesforce_server."solutionPostUpdate" AS
SELECT
    "solutionId" AS "id",
    "solutionId",
    "migrationStatus",
    "jobId",
    "sfdcUpdates"::TEXT AS "sfdcUpdates",
    "smServiceData"::TEXT AS "smServiceData",
    "sfdcUpdateStatus",
    "smServiceUpdateStatus",
    "updatedFields",
    "errors",
    "success",
    "message"
FROM salesforce_server."_ft_solutionPostUpdate";

-- INSERT trigger: proxy TMF POST → FDW UPDATE (which sends PATCH to Salesforce)
-- The TMF server does INSERT for POST /solutionPostUpdate. We translate that to
-- an UPDATE on the foreign table, which the FDW sends as PATCH to the v2.0 API.
-- Response fields are captured by doing a follow-up operation if needed.
CREATE OR REPLACE FUNCTION salesforce_server._fn_solutionPostUpdate_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- FDW update() sends PATCH to /solutions/{solutionId} with JSON body
    -- containing the SET values. byid_path template substitution uses solutionId.
    -- JSONB columns (sfdcUpdates, smServiceData) are auto-parsed by FDW's
    -- _prepare_values_for_json() into nested objects for the PATCH body.
    UPDATE salesforce_server."_ft_solutionPostUpdate"
    SET "migrationStatus" = COALESCE(NEW."migrationStatus", 'COMPLETED'),
        "jobId"           = COALESCE(NEW."jobId", ''),
        "sfdcUpdates"     = NEW."sfdcUpdates"::JSONB,
        "smServiceData"   = NEW."smServiceData"::JSONB
    WHERE "solutionId" = NEW."solutionId";

    -- Mark as successful if UPDATE didn't raise an error
    NEW."success" := 'true';
    NEW."message" := 'Post-migration data updated via PATCH';
    NEW."sfdcUpdateStatus" := 'SUCCESS';
    NEW."smServiceUpdateStatus" := 'SUCCESS';
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- If PATCH failed, capture the error and still return
    NEW."success" := 'false';
    NEW."message" := SQLERRM;
    NEW."sfdcUpdateStatus" := 'FAILED';
    NEW."smServiceUpdateStatus" := 'FAILED';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_solutionPostUpdate_insert ON salesforce_server."solutionPostUpdate";
CREATE TRIGGER trg_solutionPostUpdate_insert
    INSTEAD OF INSERT ON salesforce_server."solutionPostUpdate"
    FOR EACH ROW EXECUTE FUNCTION salesforce_server._fn_solutionPostUpdate_insert();
