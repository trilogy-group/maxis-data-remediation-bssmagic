export interface TribalKnowledge {
  id: string;
  domain: string;
  fact: string;
  evidenceQuery: string;
  evidenceResult: string;
  implication: string;
  resolution: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confirmedBy: string[];
  discoveredDate: string;
  scope: 'customer_specific' | 'generic';
  relatedEntity?: string;
}

export const TRIBAL_KNOWLEDGE: TribalKnowledge[] = [
  {
    id: 'TK-OFL-001',
    domain: 'OrderFulfillment',
    fact: "csord__Status__c on Order never transitions to 'Completed' in Maxis — use csord__Status2__c as the authoritative order status field",
    evidenceQuery: "SELECT csord__Status__c, COUNT(Id) FROM csord__Order__c WHERE CreatedDate > 2026-01-01T00:00:00Z GROUP BY csord__Status__c",
    evidenceResult: '42,708 In Provisioning (99.998%), 1 Cancelled (0.002%)',
    implication: 'Any report using Status__c to find stuck orders produces ~41,000 false positives',
    resolution: 'Use csord__Status2__c for all order status queries',
    severity: 'critical',
    confirmedBy: ['CloudSense Genie', 'Maxis Production SOQL'],
    discoveredDate: '2026-02-12',
    scope: 'customer_specific',
    relatedEntity: 'productOrder',
  },
  {
    id: 'TK-OFL-002',
    domain: 'OrderFulfillment',
    fact: 'Requires Update and Incomplete basket statuses are normal transient states during product configuration, not errors',
    evidenceQuery: 'SELECT Field, OldValue, NewValue FROM cscfga__Product_Basket__History WHERE ParentId IN (5 investigated baskets)',
    evidenceResult: 'All 5 baskets went None -> Requires Update -> Valid -> Submitted',
    implication: 'RPA reports flagging baskets in Requires Update are capturing in-flight configuration, not errors',
    resolution: 'Do not flag baskets as stuck during Requires Update or Incomplete — wait for Valid or timeout',
    severity: 'high',
    confirmedBy: ['CloudSense Genie'],
    discoveredDate: '2026-02-12',
    scope: 'generic',
    relatedEntity: 'shoppingCart',
  },
  {
    id: 'TK-OFL-003',
    domain: 'OrderFulfillment',
    fact: 'MNP port-in follows a 3-day rejection cycle — donor carrier has 3 days to accept/reject, then auto-retry',
    evidenceQuery: "SELECT Field, OldValue, NewValue, CreatedDate FROM csord__Service__History WHERE ParentId = (investigated service) AND Field = 'csord__Status__c'",
    evidenceResult: 'Jan 30: Port-In Initiated, Feb 02: Port-In Rejected (3d), Feb 02: Port-In Initiated (retry), Feb 05: Rejected again (3d), Feb 10: Initiated (3rd attempt)',
    implication: 'After 2 failed port-in attempts, manual MNP coordinator intervention is needed',
    resolution: 'Escalate to MNP coordinator after 3 rejections or 10 days elapsed',
    severity: 'high',
    confirmedBy: ['Maxis Production SOQL'],
    discoveredDate: '2026-02-12',
    scope: 'customer_specific',
    relatedEntity: 'service',
  },
  {
    id: 'TK-OFL-006',
    domain: 'OrderFulfillment',
    fact: '82% of RPA basket rejections are Details/Info Mismatch with 6 distinct root cause sub-patterns',
    evidenceQuery: "SELECT Basket_Reject_Reason__c, Basket_Reject_Remarks__c FROM cscfga__Product_Basket__c WHERE Basket_Rejected__c = true AND CreatedById = '0052r000001PgvOAAS'",
    evidenceResult: '46 mismatch rejections: penalty waiver (10), contract remaining (8), fulfillment method (3), PIC mismatch (5), campaign code (5), VSN tagging (2), manual override (5), other (8)',
    implication: 'RPA and non-RPA baskets have identical rejection profiles (82% vs 79% mismatch) — this is a Webform data quality problem, not RPA-specific',
    resolution: 'Add 3-field pre-submission validation to RPA bot (penalty waiver, contract remaining, fulfillment method) to prevent 46% of rejections',
    severity: 'high',
    confirmedBy: ['Maxis Production SOQL'],
    discoveredDate: '2026-02-12',
    scope: 'customer_specific',
    relatedEntity: 'shoppingCart',
  },
  {
    id: 'TK-OFL-007',
    domain: 'OrderFulfillment',
    fact: "CSPOFA poller processes solutions via Change_Solution_Status__c = 'New' on csord__Solution__c, NOT baskets",
    evidenceQuery: 'SELECT Change_Solution_Status__c, COUNT(Id) cnt FROM csord__Solution__c GROUP BY Change_Solution_Status__c ORDER BY COUNT(Id) DESC',
    evidenceResult: "2,862,250 solutions stuck with Change_Solution_Status__c = 'New'. 97% are stale: 2.08M already Completed, 606K have NULL status.",
    implication: 'CSPOFA poller wastes governor limit budget trying to process 2.86M stale solutions. When a batch includes solutions from large accounts, cumulative SOQL rows exceed 50K.',
    resolution: "1) Bulk-clear Change_Solution_Status__c from 'New' to 'Completed' for already-completed solutions (2.08M). 2) Clear orphaned NULL-status solutions (606K). 3) Implement per-batch SOQL row budgeting.",
    severity: 'critical',
    confirmedBy: ['Maxis Production SOQL', 'Independent investigation Feb 2026'],
    discoveredDate: '2026-02-23',
    scope: 'customer_specific',
    relatedEntity: 'product',
  },
  {
    id: 'TK-OFL-008',
    domain: 'OrderFulfillment',
    fact: 'For CSPOFA governor limit errors, the triggering batch is identified by querying csord__Solution__c WHERE LastModifiedDate is within the error timeframe, then tracing each solution to its account.',
    evidenceQuery: 'SELECT Id, Name, csord__Account__c, csord__Account__r.Name, Change_Solution_Status__c FROM csord__Solution__c WHERE LastModifiedDate >= 2026-02-20T01:35:00Z AND LastModifiedDate <= 2026-02-20T01:37:00Z',
    evidenceResult: '9 solutions at error time. 7 belonged to KK SUPERMART (3,745 services + 3,534 subs + 994 orders = 8,273 records), 2 to G-PLANTER (834 services).',
    implication: 'Investigating only baskets misses the primary trigger. The CSPOFA poller batches multiple solutions from the same large account, causing repeated account-scope queries.',
    resolution: 'When investigating CSPOFA errors, ALWAYS query csord__Solution__c (not just baskets) around the error time. Group by csord__Account__c to identify which accounts dominated the batch.',
    severity: 'critical',
    confirmedBy: ['Maxis Production SOQL', 'Independent investigation Feb 2026'],
    discoveredDate: '2026-02-23',
    scope: 'customer_specific',
    relatedEntity: 'product',
  },
  {
    id: 'TK-OFL-009',
    domain: 'OrderFulfillment',
    fact: '20 accounts in Maxis production have more than 5,000 services each. The largest (ACO TECH SDN BHD) has 952,514 services and 780,286 subscriptions.',
    evidenceQuery: 'SELECT Account__c, COUNT(Id) cnt FROM csord__Service__c GROUP BY Account__c HAVING COUNT(Id) > 5000 ORDER BY COUNT(Id) DESC LIMIT 20',
    evidenceResult: 'Top 5: ACO TECH 952K, YAYASAN HASANAH 100K, KEMENTERIAN PENDIDIKAN 91K, NULL accounts 71K, MAXIS BROADBAND 59K.',
    implication: 'These mega-accounts are ticking time bombs for any batch process that queries account-scope records. The 50K governor limit will always be hit.',
    resolution: '1) Account-size-aware batch splitting in CSPOFA. 2) For accounts with >10K services, process in isolated single-account batches. 3) Consider async Queueable chains.',
    severity: 'critical',
    confirmedBy: ['Maxis Production SOQL', 'Independent investigation Feb 2026'],
    discoveredDate: '2026-02-23',
    scope: 'customer_specific',
    relatedEntity: 'service',
  },
];

export interface DetectionFunction {
  name: string;
  description: string;
  objectType: string;
  soqlCondition: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resolutionAction: string;
  source: 'discovered' | 'manual';
}

export const DETECTION_FUNCTIONS: DetectionFunction[] = [
  {
    name: 'false_positive_stuck_orders',
    description: "Detects orders flagged as stuck based on csord__Status__c = 'In Provisioning' when csord__Status2__c shows they are actually completed or progressing",
    objectType: 'csord__Order__c',
    soqlCondition: "csord__Status__c = 'In Provisioning' AND csord__Status2__c NOT IN ('In Provisioning', 'Initiated', NULL)",
    severity: 'critical',
    resolutionAction: 'Reclassify as not-stuck. Update reports to use csord__Status2__c instead of csord__Status__c',
    source: 'discovered',
  },
  {
    name: 'stuck_port_in',
    description: 'Services stuck in Port-In cycle for more than 7 days (2+ failed attempts)',
    objectType: 'csord__Service__c',
    soqlCondition: "csord__Status__c LIKE '%Port-In%' AND LastModifiedDate < LAST_N_DAYS:7",
    severity: 'high',
    resolutionAction: 'Escalate to MNP coordinator for manual intervention',
    source: 'discovered',
  },
  {
    name: 'rpa_rejected_data_quality',
    description: 'RPA baskets rejected due to data quality (Details/Info Mismatch) that could be prevented by pre-submission validation',
    objectType: 'cscfga__Product_Basket__c',
    soqlCondition: "Basket_Rejected__c = true AND Basket_Reject_Reason__c = 'Details/Info Mismatch' AND CreatedById = '0052r000001PgvOAAS'",
    severity: 'high',
    resolutionAction: 'Add 3-field pre-submission check to RPA bot (penalty_waiver, contract_remaining, fulfillment_method)',
    source: 'discovered',
  },
  {
    name: 'cspofa_stale_solution_queue',
    description: "Detect stale solutions stuck in the CSPOFA processing queue (Change_Solution_Status__c = 'New') that are already Completed or have NULL status. These waste governor limit budget and cause 50K row errors.",
    objectType: 'csord__Solution__c',
    soqlCondition: "Change_Solution_Status__c = 'New' AND (csord__Status__c = 'Completed' OR csord__Status__c = null)",
    severity: 'critical',
    resolutionAction: "Bulk-update Change_Solution_Status__c from 'New' to 'Completed' for already-completed solutions. Investigate NULL-status solutions as possible orphaned migration artifacts.",
    source: 'discovered',
  },
  {
    name: 'mega_account_governor_risk',
    description: 'Detect accounts with more than 5,000 services that are at systemic risk for Salesforce governor limit errors (50K SOQL rows) during any batch processing.',
    objectType: 'Account',
    soqlCondition: 'Id IN (SELECT Account__c FROM csord__Service__c GROUP BY Account__c HAVING COUNT(Id) > 5000)',
    severity: 'critical',
    resolutionAction: 'Implement account-size-aware batch splitting. For accounts with >10K services, process in isolated single-account batches.',
    source: 'discovered',
  },
];
