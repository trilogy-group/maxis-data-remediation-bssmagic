export interface WorkflowStep {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
  endpoint: string;
  description: string;
  onFailure: string;
  duration: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger: string;
  issueType: string;
  steps: WorkflowStep[];
  safetyRules: string[];
  metrics: { label: string; value: string }[];
}

export const WORKFLOWS: Workflow[] = [
  {
    id: 'wf-1147',
    name: '5-Step Solution Remediation (1147)',
    description: 'Fixes SolutionEmpty issues where the Product Basket link is missing. Deletes existing SM artifacts, triggers re-migration, waits for completion, then updates migration flags.',
    trigger: 'POST /remediate/{solutionId} (Batch Orchestrator)',
    issueType: 'SolutionEmpty',
    steps: [
      {
        id: 'validate',
        name: 'VALIDATE',
        method: 'GET',
        endpoint: '/tmf-api/solutionManagement/v5/solutionInfo/{id}',
        description: 'Check MACD eligibility: basket stage not in "Order Enrichment"/"Submitted", basket age >= 60 days',
        onFailure: 'SKIP - Mark ServiceProblem as "rejected" with reason',
        duration: '~500ms',
      },
      {
        id: 'delete',
        name: 'DELETE',
        method: 'DELETE',
        endpoint: '/tmf-api/solutionManagement/v5/solutionMigration/{id}',
        description: 'Clean up existing SM artifacts (Heroku PostgreSQL entries) before re-migration',
        onFailure: 'ABORT - Cannot proceed without clean state',
        duration: '~1-2s',
      },
      {
        id: 'migrate',
        name: 'MIGRATE',
        method: 'POST',
        endpoint: '/tmf-api/solutionManagement/v5/solutionMigration',
        description: 'Trigger re-migration of the Solution. Returns a jobId for polling.',
        onFailure: 'ABORT - Log error, mark ServiceProblem as "rejected"',
        duration: '~1-2s (async start)',
      },
      {
        id: 'poll',
        name: 'POLL',
        method: 'GET',
        endpoint: '/tmf-api/solutionManagement/v5/migrationStatus/{id}',
        description: 'Exponential backoff polling until migration completes (initial 10s, max 60s, timeout 30min)',
        onFailure: 'TIMEOUT after 30 minutes - Mark as "rejected"',
        duration: '10s - 30min',
      },
      {
        id: 'post-update',
        name: 'POST_UPDATE',
        method: 'PATCH',
        endpoint: '/tmf-api/solutionManagement/v5/solutionPostUpdate',
        description: 'Set isMigratedToHeroku=true, isConfigurationUpdatedToHeroku=true, clear externalIdentifier',
        onFailure: 'WARNING - Migration succeeded but flags not updated',
        duration: '~1-2s',
      },
    ],
    safetyRules: [
      'Skip solutions with baskets in "Order Enrichment" or "Submitted" stage (active journey)',
      'Skip solutions with baskets younger than 60 days',
      'Skip if MACD relationships exist with recent baskets',
      'Maximum concurrency: 15 parallel remediations',
      'State machine enforces valid transitions only',
    ],
    metrics: [
      { label: 'Avg Duration', value: '~45 seconds' },
      { label: 'Success Rate', value: '~92%' },
      { label: 'Concurrency', value: '15 parallel' },
      { label: 'Timeout', value: '30 minutes max' },
    ],
  },
  {
    id: 'wf-1867',
    name: '4-Step OE Remediation (1867)',
    description: 'Fixes PartialDataMissing issues where Order Entry JSON is missing mandatory fields (ReservedNumber, BillingAccount, PICEmail, eSMSUserName). Patches the ProductAttributeDetails.json attachment.',
    trigger: 'POST /oe/remediate/{serviceId} (Batch Orchestrator)',
    issueType: 'PartialDataMissing',
    steps: [
      {
        id: 'fetch',
        name: 'FETCH',
        method: 'GET',
        endpoint: '/tmf-api/custom/oeServiceInfo/{id}',
        description: 'Fetch migrated service details, OE JSON data, and associated Product Configuration',
        onFailure: 'SKIP - Service not found or not eligible',
        duration: '~500ms',
      },
      {
        id: 'analyze',
        name: 'ANALYZE',
        method: 'GET',
        endpoint: '(internal analysis)',
        description: 'Parse OE JSON, identify missing mandatory fields per service type (Voice: ReservedNumber; Access: BillingAccount; Fibre: PICEmail; eSMS: eSMSUserName)',
        onFailure: 'SKIP - No fields to patch',
        duration: '~100ms',
      },
      {
        id: 'patch',
        name: 'PATCH',
        method: 'PUT',
        endpoint: '/tmf-api/custom/oeServiceAttachment/{id}',
        description: 'Update ProductAttributeDetails.json with patched OE data (both CloudSense internal DB and Salesforce attachment)',
        onFailure: 'ABORT - Log error, mark as "rejected"',
        duration: '~1-3s',
      },
      {
        id: 'sync',
        name: 'SYNC',
        method: 'POST',
        endpoint: '/tmf-api/custom/oeServiceRemediation/{id}',
        description: 'Trigger full OE data synchronization to verify consistency between internal DB and attachment',
        onFailure: 'WARNING - Patch applied but sync failed',
        duration: '~1-2s',
      },
    ],
    safetyRules: [
      'Only patch services with Migrated_Data__c = true',
      'Only patch services with Service_Type__c in scope (Voice, Fibre, eSMS, Access)',
      'Skip services with csordtelcoa__Replacement_Service__c set (MACD replacements)',
      'Verify attachment exists before patching',
      'Create backup of original attachment before modification',
    ],
    metrics: [
      { label: 'Avg Duration', value: '~5 seconds' },
      { label: 'Success Rate', value: '~95%' },
      { label: 'Batch Size', value: 'Up to 200' },
      { label: 'Fields Patched', value: '4 types' },
    ],
  },
];
