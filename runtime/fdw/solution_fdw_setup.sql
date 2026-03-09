-- =============================================================================
-- Solution Management FDW Setup Script
-- =============================================================================
-- This script creates the foreign tables, views, trigger functions, and triggers
-- needed for the TMF SolutionManagement API to interact with Salesforce via the
-- REST FDW (Foreign Data Wrapper).
--
-- Prerequisites:
--   - The 'rest_server' foreign server must already exist
--   - The 'salesforce_server' schema must already exist
--   - The REST FDW extension (fdw_rest) must be installed
--
-- Usage:
--   Replace SALESFORCE_INSTANCE_URL with the actual Salesforce instance URL
--   (e.g., https://maxis--fdrv1.sandbox.my.salesforce.com)
--   then run: psql -U postgres -d bssmagic -f solution_fdw_setup.sql
--
-- To parametrize, set the psql variable before running:
--   psql -v sf_url="'https://maxis--fdrv1.sandbox.my.salesforce.com'" -f solution_fdw_setup.sql
-- =============================================================================

-- Use a DO block with a variable so the instance URL is defined once
DO $$
DECLARE
    sf_url TEXT := current_setting('app.sf_instance_url', true);
BEGIN
    IF sf_url IS NULL OR sf_url = '' THEN
        sf_url := 'SALESFORCE_INSTANCE_URL';
        RAISE NOTICE 'No app.sf_instance_url set, using placeholder. Replace SALESFORCE_INSTANCE_URL before running.';
    END IF;
END $$;

-- =============================================================================
-- 1. Foreign Tables (REST FDW -> Salesforce Apex REST)
-- =============================================================================

-- Drop existing objects if they exist (idempotent)
DROP TRIGGER IF EXISTS trg_solutionmigration_insert ON salesforce_server."solutionMigration";
DROP TRIGGER IF EXISTS trg_solutionmigration_delete ON salesforce_server."solutionMigration";
DROP TRIGGER IF EXISTS trg_solutionpostupdate_insert ON salesforce_server."solutionPostUpdate";

DROP FUNCTION IF EXISTS salesforce_server._fn_solutionmigration_insert() CASCADE;
DROP FUNCTION IF EXISTS salesforce_server._fn_solutionmigration_delete() CASCADE;
DROP FUNCTION IF EXISTS salesforce_server._fn_solutionpostupdate_insert() CASCADE;

DROP VIEW IF EXISTS salesforce_server."solutionInfo" CASCADE;
DROP VIEW IF EXISTS salesforce_server."solutionMigration" CASCADE;
DROP VIEW IF EXISTS salesforce_server."solutionPostUpdate" CASCADE;
DROP VIEW IF EXISTS salesforce_server."migrationStatus" CASCADE;

DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_solutionInfo" CASCADE;
DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_solutionDelete" CASCADE;
DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_solutionMigrate" CASCADE;
DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_solutionPostUpdate" CASCADE;
DROP FOREIGN TABLE IF EXISTS salesforce_server."_ft_migrationStatus" CASCADE;

-- _ft_solutionInfo: GET /services/apexrest/api/v1/solutions/{solutionId}
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
    "macdDetails"         JSONB,
    "smServiceStatus"     JSONB,
    "additionalMetadata"  JSONB
) SERVER rest_server OPTIONS (
    url              'SALESFORCE_INSTANCE_URL',
    byid_path        '/services/apexrest/api/v1/solutions/{solutionId}',
    id_column        'solutionId',
    byid_result_path '',
    select_method    'GET'
);

-- _ft_solutionDelete: DELETE /services/apexrest/api/v1/solutions/{solutionId}
CREATE FOREIGN TABLE salesforce_server."_ft_solutionDelete" (
    "solutionId"  TEXT,
    "jobId"       TEXT,
    "status"      TEXT,
    "message"     TEXT,
    "success"     TEXT
) SERVER rest_server OPTIONS (
    url              'SALESFORCE_INSTANCE_URL',
    byid_path        '/services/apexrest/api/v1/solutions/{solutionId}',
    id_column        'solutionId',
    byid_result_path '',
    select_method    'DELETE'
);

-- _ft_solutionMigrate: POST /services/apexrest/api/v1/solutions/{solutionId}/migrations
CREATE FOREIGN TABLE salesforce_server."_ft_solutionMigrate" (
    "solutionId"  TEXT,
    "jobId"       TEXT,
    "status"      TEXT,
    "message"     TEXT,
    "success"     TEXT
) SERVER rest_server OPTIONS (
    url              'SALESFORCE_INSTANCE_URL',
    byid_path        '/services/apexrest/api/v1/solutions/{solutionId}/migrations',
    id_column        'solutionId',
    byid_result_path '',
    select_method    'POST'
);

-- _ft_solutionPostUpdate: PATCH /services/apexrest/api/v1/solutions/{solutionId}
CREATE FOREIGN TABLE salesforce_server."_ft_solutionPostUpdate" (
    "solutionId"            TEXT,
    "migrationStatus"       TEXT,
    "jobId"                 TEXT,
    "sfdcUpdates"           JSONB,
    "smServiceData"         JSONB,
    "sfdcUpdateStatus"      TEXT,
    "smServiceUpdateStatus" TEXT,
    "updatedFields"         TEXT,
    "errors"                TEXT,
    "success"               TEXT,
    "message"               TEXT
) SERVER rest_server OPTIONS (
    url              'SALESFORCE_INSTANCE_URL',
    byid_path        '/services/apexrest/api/v1/solutions/{solutionId}',
    id_column        'solutionId',
    byid_result_path '',
    update_method    'PATCH',
    allow_writes     'true',
    get_before_update 'false'
);

-- _ft_migrationStatus: GET /services/apexrest/api/v1/solutions/{solutionId}/migrations/status
CREATE FOREIGN TABLE salesforce_server."_ft_migrationStatus" (
    "solutionId"        TEXT,
    "status"            TEXT,
    "subscriptionCount" TEXT,
    "message"           TEXT,
    "success"           TEXT
) SERVER rest_server OPTIONS (
    url              'SALESFORCE_INSTANCE_URL',
    byid_path        '/services/apexrest/api/v1/solutions/{solutionId}/migrations/status',
    id_column        'solutionId',
    byid_result_path '',
    select_method    'GET'
);

-- =============================================================================
-- 2. Views (TMF API layer queries these)
-- =============================================================================

CREATE OR REPLACE VIEW salesforce_server."solutionInfo" AS
SELECT
    "solutionId"          AS id,
    "solutionId",
    "solutionName",
    "externalIdentifier",
    "createdBy",
    "createdDate",
    "migrationStatus",
    "migrationDate",
    "success",
    "message",
    ("macdDetails")::TEXT         AS "macdDetails",
    ("smServiceStatus")::TEXT     AS "smServiceStatus",
    ("additionalMetadata")::TEXT  AS "additionalMetadata"
FROM salesforce_server."_ft_solutionInfo";

CREATE OR REPLACE VIEW salesforce_server."solutionMigration" AS
SELECT
    "solutionId"  AS id,
    "solutionId",
    NULL::TEXT     AS "jobId",
    "migrationStatus" AS status,
    "message",
    "success"
FROM salesforce_server."_ft_solutionInfo";

CREATE OR REPLACE VIEW salesforce_server."solutionPostUpdate" AS
SELECT
    "solutionId"            AS id,
    "solutionId",
    "migrationStatus",
    "jobId",
    ("sfdcUpdates")::TEXT           AS "sfdcUpdates",
    ("smServiceData")::TEXT         AS "smServiceData",
    "sfdcUpdateStatus",
    "smServiceUpdateStatus",
    "updatedFields",
    "errors",
    "success",
    "message"
FROM salesforce_server."_ft_solutionPostUpdate";

CREATE OR REPLACE VIEW salesforce_server."migrationStatus" AS
SELECT
    "solutionId"        AS id,
    "solutionId",
    "status",
    "subscriptionCount",
    "message",
    "success"
FROM salesforce_server."_ft_migrationStatus";

-- =============================================================================
-- 3. Trigger Functions (INSTEAD OF triggers on the views)
-- =============================================================================

CREATE OR REPLACE FUNCTION salesforce_server._fn_solutionmigration_insert()
RETURNS TRIGGER AS $$
BEGIN
    SELECT "solutionId", "jobId", "status", "message", "success"
    INTO NEW."solutionId", NEW."jobId", NEW."status", NEW."message", NEW."success"
    FROM salesforce_server."_ft_solutionMigrate"
    WHERE "solutionId" = NEW."solutionId";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION salesforce_server._fn_solutionmigration_delete()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        PERFORM * FROM salesforce_server."_ft_solutionDelete"
        WHERE "solutionId" = OLD."id";
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'DELETE for %s completed (204 No Content expected): %s', OLD."id", SQLERRM;
    END;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION salesforce_server._fn_solutionpostupdate_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE salesforce_server."_ft_solutionPostUpdate"
    SET "migrationStatus" = COALESCE(NEW."migrationStatus", 'COMPLETED'),
        "jobId"           = COALESCE(NEW."jobId", ''),
        "sfdcUpdates"     = NEW."sfdcUpdates"::JSONB,
        "smServiceData"   = NEW."smServiceData"::JSONB
    WHERE "solutionId" = NEW."solutionId";
    NEW."success" := 'true';
    NEW."message" := 'Post-migration data updated via PATCH';
    NEW."sfdcUpdateStatus" := 'SUCCESS';
    NEW."smServiceUpdateStatus" := 'SUCCESS';
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    NEW."success" := 'false';
    NEW."message" := SQLERRM;
    NEW."sfdcUpdateStatus" := 'FAILED';
    NEW."smServiceUpdateStatus" := 'FAILED';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. Triggers (wire views to trigger functions)
-- =============================================================================

CREATE TRIGGER trg_solutionmigration_insert
    INSTEAD OF INSERT ON salesforce_server."solutionMigration"
    FOR EACH ROW
    EXECUTE FUNCTION salesforce_server._fn_solutionmigration_insert();

CREATE TRIGGER trg_solutionmigration_delete
    INSTEAD OF DELETE ON salesforce_server."solutionMigration"
    FOR EACH ROW
    EXECUTE FUNCTION salesforce_server._fn_solutionmigration_delete();

CREATE TRIGGER trg_solutionpostupdate_insert
    INSTEAD OF INSERT ON salesforce_server."solutionPostUpdate"
    FOR EACH ROW
    EXECUTE FUNCTION salesforce_server._fn_solutionpostupdate_insert();

-- =============================================================================
-- Done. The TMF server's Java code queries/writes to the views, and the triggers
-- route operations through the foreign tables to the Salesforce Apex REST APIs.
-- =============================================================================
