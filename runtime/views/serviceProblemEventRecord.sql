-- ServiceProblemEventRecord View (Enhanced)
-- Maps: AsyncApexJob -> ServiceProblemEventRecord
-- Exposes Apex batch jobs as events related to ServiceProblem remediation

DROP VIEW IF EXISTS salesforce_server."serviceProblemEventRecord";

CREATE VIEW salesforce_server."serviceProblemEventRecord" AS
SELECT
    t0."Id"::text AS "id",
    ('http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com/tmf-api/serviceProblemManagement/v5/serviceProblemEventRecord/' || t0."Id")::text AS "href",
    
    -- Event timing
    t0."CreatedDate"::timestamp(0) with time zone AS "eventTime",
    COALESCE(t0."CompletedDate", t0."CreatedDate")::timestamp(0) with time zone AS "recordTime",
    
    -- Event type = Apex class name + status + errors
    CASE 
        WHEN t0."NumberOfErrors" > 0 THEN
            CONCAT(COALESCE(t1."Name", 'BatchJob'), ' - ', t0."Status", ' (', t0."NumberOfErrors", ' errors)')
        ELSE
            CONCAT(COALESCE(t1."Name", 'BatchJob'), ' - ', t0."Status")
    END::text AS "eventType",
    
    -- Service Problem reference (NULL - no direct link)
    ROW(
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::text
    )::"tmf"."ServiceProblemRef" AS "serviceProblem",
    
    -- Notification contains full job details
    ROW(
        -- @type: Full summary with all details
        CONCAT(
            t0."JobType", ': ', COALESCE(t1."Name", 'Unknown'),
            ' | Status: ', t0."Status",
            ' | Items: ', COALESCE(t0."JobItemsProcessed"::text, '0'), '/', COALESCE(t0."TotalJobItems"::text, '0'),
            CASE WHEN t0."NumberOfErrors" > 0 THEN ' | Errors: ' || t0."NumberOfErrors"::text ELSE '' END,
            CASE WHEN t0."ExtendedStatus" IS NOT NULL AND t0."ExtendedStatus" != '' THEN ' | Detail: ' || t0."ExtendedStatus" ELSE '' END,
            CASE WHEN t0."MethodName" IS NOT NULL THEN ' | Method: ' || t0."MethodName" ELSE '' END
        )::text,
        -- @baseType: JobType
        t0."JobType"::text,
        -- @schemaLocation: CreatedBy user ID
        t0."CreatedById"::text
    )::"tmf"."Any" AS "notification"
    
FROM salesforce_server."AsyncApexJob" t0
LEFT JOIN salesforce_server."ApexClass" t1 ON t0."ApexClassId" = t1."Id"
WHERE t0."JobType" IN ('BatchApex', 'Queueable');
