-- =====================================================================
-- ServiceProblem View (TMF656) - Confirmed Issues & Remediation Tracking
-- =====================================================================
-- Maps: tmf."serviceProblem" table -> salesforce_server."serviceProblem"
-- Endpoint: /tmf-api/serviceProblemManagement/v5/serviceProblem
-- 
-- This view exposes the native serviceProblem table for TMF API access.
-- ServiceProblem records are created automatically when issues are
-- confirmed (e.g., Solution Empty detected) and updated during remediation.
--
-- Category values:
--   SolutionEmpty     - 1147 module: Solution has no product basket linked
--   PartialDataMissing - 1867 module: OE JSON has missing mandatory fields
--
-- Status lifecycle:
--   pending      -> Issue detected, awaiting remediation
--   inProgress   -> Remediation in progress
--   resolved     -> Remediation completed successfully
--   rejected     -> Remediation failed
-- =====================================================================

DROP VIEW IF EXISTS salesforce_server."serviceProblem";

-- Simple view that exposes the native tmf.serviceProblem table
-- The table already has all the TMF656 fields defined
CREATE VIEW salesforce_server."serviceProblem" AS
SELECT
    "affectedLocation",
    "affectedNumberOfServices",
    "affectedResource",
    "affectedService",
    "note",
    "externalIdentifier",
    "name",
    "characteristic",
    "firstAlert",
    "impactImportanceFactor",
    "impactPattern",
    "originatingSystem",
    "parentProblem",
    "problemEscalation",
    "relatedEvent",
    "relatedEntity",
    "responsibleParty",
    "relatedParty",
    "rootCauseResource",
    "rootCauseService",
    "resolutionDate",
    "status",
    "statusChangeDate",
    "statusChangeReason",
    "lastUpdate",
    "creationDate",
    "trackingRecord",
    "underlyingAlarm",
    "slaViolation",
    "troubleTicket",
    "underlyingProblem",
    "errorMessage",
    "category",
    "description",
    "priority",
    "reason",
    "originatorParty",
    "href",
    "id",
    "@type",
    "@baseType",
    "@schemaLocation"
FROM tmf."serviceProblem";
