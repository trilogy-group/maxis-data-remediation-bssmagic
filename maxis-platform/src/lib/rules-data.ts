export interface DetectionRule {
  id: string;
  name: string;
  tag: string;
  tagColor: string;
  condition: string;
  description: string;
  affectedEntities: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  sqlView: string;
  detectionField: string;
}

export const DETECTION_RULES: DetectionRule[] = [
  {
    id: 'rule-1147',
    name: 'Solution Missing Product Basket',
    tag: 'SolutionEmpty',
    tagColor: 'bg-red-500',
    condition: 'If Solution has no Product Basket linked (cssdm__product_basket__c IS NULL) AND created by Migration User, classify as SolutionEmpty',
    description: 'Solutions missing Product Basket link cannot progress through the order lifecycle. This blocks revenue and requires re-migration via the 5-step remediation flow (VALIDATE -> DELETE -> MIGRATE -> POLL -> POST_UPDATE).',
    affectedEntities: ['Product (TMF637)', 'ServiceProblem (TMF656)'],
    severity: 'critical',
    category: 'SolutionEmpty',
    sqlView: 'product.sql',
    detectionField: 'x_hasIssue = (x_createdByName = "Migration User" AND x_migrationStatus = "Not Migrated Successfully")',
  },
  {
    id: 'rule-1867',
    name: 'Migrated Services - Missing OE Fields',
    tag: 'PartialDataMissing',
    tagColor: 'bg-orange-500',
    condition: 'If Service has x_has1867Issue = true (migrated + service type IN Voice/Fibre/eSMS/Access + no replacement service), classify as PartialDataMissing',
    description: 'Order Entry JSON attached to Product Configurations is missing mandatory fields (ReservedNumber, BillingAccount, PICEmail, eSMSUserName). Requires 4-step OE remediation flow (FETCH -> ANALYZE -> PATCH -> SYNC).',
    affectedEntities: ['Service (TMF638)', 'ServiceProblem (TMF656)'],
    severity: 'high',
    category: 'PartialDataMissing',
    sqlView: 'service.sql',
    detectionField: 'x_has1867Issue = (x_migratedData = true AND x_serviceType IN (Voice, Fibre, eSMS, Access) AND x_replacementServiceId IS NULL)',
  },
  {
    id: 'rule-failed-migration',
    name: 'Failed Migration',
    tag: 'MigrationFailed',
    tagColor: 'bg-yellow-500',
    condition: 'If Solution status = "Not Migrated Successfully" AND no subsequent successful migration attempt, classify as MigrationFailed',
    description: 'Solutions that failed the SM-to-Heroku migration and remain stuck. May require manual intervention or re-triggering of the migration batch job.',
    affectedEntities: ['Product (TMF637)', 'ServiceProblem (TMF656)'],
    severity: 'medium',
    category: 'MigrationFailed',
    sqlView: 'failedMigrationSolutions.sql',
    detectionField: 'csord__External_Identifier__c = "Not Migrated Successfully"',
  },
  {
    id: 'rule-billing-account',
    name: 'Missing Billing Account',
    tag: 'BillingAccountMissing',
    tagColor: 'bg-blue-500',
    condition: 'If Service has no Billing Account link (Billing_Account__c IS NULL), classify as BillingAccountMissing',
    description: '50.4% of production services (162K) lack Billing Account references, creating revenue leakage risk. Identified as a systemic data quality issue from the CloudSense migration.',
    affectedEntities: ['Service (TMF638)', 'BillingAccount (TMF666)', 'ServiceProblem (TMF656)'],
    severity: 'medium',
    category: 'BillingAccountMissing',
    sqlView: 'service.sql',
    detectionField: 'Billing_Account__c IS NULL',
  },
];
