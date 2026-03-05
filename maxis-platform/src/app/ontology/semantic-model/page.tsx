'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Search, Plus, Tag } from 'lucide-react';

type TagCategory = 'DOMAIN' | 'CONCERN' | 'SKILL' | 'CONSTRAINT';

interface SemanticTag {
  id: string;
  name: string;
  category: TagCategory;
  rules: SemanticRule[];
}

interface SemanticRule {
  id: string;
  text: string;
  tags: string[];
  source?: string;
}

const CATEGORY_COLORS: Record<TagCategory, { bg: string; text: string }> = {
  DOMAIN: { bg: 'bg-green-100 text-green-800', text: 'text-green-700' },
  CONCERN: { bg: 'bg-purple-100 text-purple-800', text: 'text-purple-700' },
  SKILL: { bg: 'bg-orange-100 text-orange-800', text: 'text-orange-700' },
  CONSTRAINT: { bg: 'bg-slate-200 text-slate-700', text: 'text-slate-600' },
};

const SEMANTIC_TAGS: SemanticTag[] = [
  // DOMAIN tags — entity descriptions
  {
    id: 'domain-service', name: 'Service', category: 'DOMAIN',
    rules: [
      { id: 'd-svc-1', text: 'Maps csord__Service__c to TMF638 Service Inventory. 321K records. Zero JOINs for maximum FDW performance. Includes x_* custom detection fields for migrated data issues.', tags: ['Service', 'TMF638'] },
    ],
  },
  {
    id: 'domain-product', name: 'Product (Solution)', category: 'DOMAIN',
    rules: [
      { id: 'd-prod-1', text: 'Maps csord__Solution__c to TMF637 Product. Architectural decision: Solution modeled as Product (not Agreement) because TMF637 has richer pricing/characteristic structures needed for dashboard and remediation. LEFT JOIN to Account for customer name.', tags: ['Product', 'TMF637', 'Solution'] },
    ],
  },
  {
    id: 'domain-order', name: 'Product Order', category: 'DOMAIN',
    rules: [
      { id: 'd-ord-1', text: 'Maps csord__Order__c to TMF622 Product Order. Uses csord__Status2__c (NOT csord__Status__c) as authoritative status — Status__c never transitions in Maxis (99.998% stuck at "In Provisioning").', tags: ['ProductOrder', 'TMF622', 'Status2'] },
    ],
  },
  {
    id: 'domain-cart', name: 'Shopping Cart (Product Basket)', category: 'DOMAIN',
    rules: [
      { id: 'd-cart-1', text: 'Maps cscfga__Product_Basket__c to TMF663 Shopping Cart. Uses ARRAY_AGG with LEFT JOIN to Product_Configuration for cartItem[]. Includes cartTotalPrice in MYR currency.', tags: ['ShoppingCart', 'TMF663', 'Basket'] },
    ],
  },
  {
    id: 'domain-ba', name: 'Billing Account', category: 'DOMAIN',
    rules: [
      { id: 'd-ba-1', text: 'Maps csconta__Billing_Account__c to TMF666 Billing Account. Zero JOINs. relatedParty array built from direct lookup fields: customer (Account), contact (PIC Email via Contact__c), creator.', tags: ['BillingAccount', 'TMF666'] },
    ],
  },
  {
    id: 'domain-org', name: 'Organization (Account)', category: 'DOMAIN',
    rules: [
      { id: 'd-org-1', text: 'Maps Salesforce Account to TMF632 Organization. Used by relatedParty[customer] references in Product, Order, and BillingAccount views.', tags: ['Organization', 'TMF632', 'Account'] },
    ],
  },
  {
    id: 'domain-individual', name: 'Individual (Contact)', category: 'DOMAIN',
    rules: [
      { id: 'd-ind-1', text: 'Maps Salesforce Contact to TMF632 Individual. Includes relatedParty linking back to Account (Organization) and CreatedBy (User).', tags: ['Individual', 'TMF632', 'Contact'] },
    ],
  },

  // CONCERN tags — business process rules / detection logic
  {
    id: 'concern-1147', name: 'Solution Missing Product Basket', category: 'CONCERN',
    rules: [
      { id: 'c-1147-1', text: 'If Solution has no Product Basket linked (cssdm__product_basket__c IS NULL) AND created by Migration User, THEN classify as SolutionEmpty. Blocks revenue — requires 5-step remediation (VALIDATE → DELETE → MIGRATE → POLL → POST_UPDATE).', tags: ['SolutionEmpty', 'Detection', 'Remediation'] },
    ],
  },
  {
    id: 'concern-1867', name: 'Migrated Services Missing OE Data', category: 'CONCERN',
    rules: [
      { id: 'c-1867-1', text: 'If Service.Migrated_Data__c = true AND Service_Type__c IN (Voice, Fibre Service, eSMS Service, Access Service) AND Replacement_Service__c IS NULL, THEN flag as x_has1867Issue. Requires 4-step OE remediation (FETCH → ANALYZE → PATCH → SYNC).', tags: ['PartialDataMissing', 'Detection', '1867'] },
    ],
  },
  {
    id: 'concern-failed-migration', name: 'Failed Migration Detection', category: 'CONCERN',
    rules: [
      { id: 'c-fm-1', text: "If Solution.csord__External_Identifier__c = 'Not Migrated Successfully' AND no subsequent successful migration, THEN classify as MigrationFailed. May require manual re-triggering of migration batch.", tags: ['MigrationFailed', 'Detection'] },
    ],
  },
  {
    id: 'concern-billing-gap', name: 'Missing Billing Account Link', category: 'CONCERN',
    rules: [
      { id: 'c-ba-1', text: 'If Service.Billing_Account__c IS NULL, THEN flag as BillingAccountMissing. 50.4% of production services (162K) lack Billing Account references — systemic CloudSense migration data quality issue creating revenue leakage risk.', tags: ['BillingAccountMissing', 'DataQuality'] },
    ],
  },
  {
    id: 'concern-false-positives', name: 'False Positive Stuck Orders', category: 'CONCERN',
    rules: [
      { id: 'c-fp-1', text: "If Order.csord__Status__c = 'In Provisioning' AND csord__Status2__c NOT IN ('In Provisioning', 'Initiated', NULL), THEN reclassify as not-stuck. Reports using Status__c produce ~41,000 false positives.", tags: ['FalsePositive', 'Status2', 'Detection'], source: 'TK-OFL-001' },
    ],
  },
  {
    id: 'concern-rpa-rejections', name: 'RPA Basket Rejection Prevention', category: 'CONCERN',
    rules: [
      { id: 'c-rpa-1', text: "If Basket_Rejected__c = true AND Basket_Reject_Reason__c = 'Details/Info Mismatch', THEN 82% are preventable. Add 3-field pre-submission validation: penalty_waiver, contract_remaining, fulfillment_method.", tags: ['RPA', 'DataQuality', 'Prevention'], source: 'TK-OFL-006' },
    ],
  },
  {
    id: 'concern-basket-transient', name: 'Transient Basket Status Handling', category: 'CONCERN',
    rules: [
      { id: 'c-bt-1', text: "If Basket.csordtelcoa__Basket_Stage__c IN ('Requires Update', 'Incomplete'), THEN do NOT flag as stuck. These are normal transient states during product configuration. Wait for 'Valid' or timeout.", tags: ['ShoppingCart', 'StatusHandling'], source: 'TK-OFL-002' },
    ],
  },

  // SKILL tags — operational capabilities
  {
    id: 'skill-solution-remediation', name: 'Solution Remediation (5-Step)', category: 'SKILL',
    rules: [
      { id: 's-sol-1', text: 'If ServiceProblem.category = SolutionEmpty, THEN execute 5-step flow via REST FDW: 1) VALIDATE (GET /solutionInfo/{id}), 2) DELETE (DELETE /solutionMigration/{id}), 3) MIGRATE (POST /solutionMigration), 4) POLL (GET /migrationStatus/{id}), 5) POST_UPDATE (POST /solutionPostUpdate).', tags: ['Remediation', 'Solution', 'REST-FDW'] },
    ],
  },
  {
    id: 'skill-oe-remediation', name: 'OE Remediation (4-Step)', category: 'SKILL',
    rules: [
      { id: 's-oe-1', text: 'If ServiceProblem.category = PartialDataMissing, THEN execute 4-step OE flow: 1) FETCH (GET /migratedServices/{id}), 2) ANALYZE (check mandatory OE fields), 3) PATCH (POST /migratedServices update), 4) SYNC (verify consistency).', tags: ['Remediation', 'OE', '1867'] },
    ],
  },
  {
    id: 'skill-port-in-escalation', name: 'MNP Port-In Escalation', category: 'SKILL',
    rules: [
      { id: 's-mnp-1', text: "If Service.csord__Status__c LIKE '%Port-In%' AND LastModifiedDate < 7 days ago (2+ failed attempts), THEN escalate to MNP coordinator. Donor carrier has 3-day rejection cycle — auto-retry until 3rd rejection.", tags: ['MNP', 'Escalation', 'Service'], source: 'TK-OFL-003' },
    ],
  },
  {
    id: 'skill-cspofa-cleanup', name: 'CSPOFA Queue Cleanup', category: 'SKILL',
    rules: [
      { id: 's-cspofa-1', text: "If Solution.Change_Solution_Status__c = 'New' AND (csord__Status__c = 'Completed' OR NULL), THEN bulk-clear to 'Completed'. 2.86M stale solutions waste governor limits — 2.08M already Completed, 606K orphaned.", tags: ['CSPOFA', 'GovernorLimit', 'Cleanup'], source: 'TK-OFL-007' },
    ],
  },
  {
    id: 'skill-mega-account-guard', name: 'Mega-Account Governor Guard', category: 'SKILL',
    rules: [
      { id: 's-mega-1', text: 'If Account service count > 5,000, THEN isolate in single-account batches. 20 accounts at risk — largest (ACO TECH) has 952K services. Standard batch processing will always hit 50K governor limit.', tags: ['GovernorLimit', 'BatchProcessing', 'Account'], source: 'TK-OFL-009' },
    ],
  },

  // CONSTRAINT tags — architectural/data layer constraints
  {
    id: 'constraint-no-attribute-join', name: 'Attribute Table Exclusion', category: 'CONSTRAINT',
    rules: [
      { id: 'x-attr-1', text: 'NEVER JOIN to cscfga__Attribute__c (7.5M records). FDW performs full table scan on JOINed tables. Characteristics sourced from parent object fields instead.', tags: ['FDW', 'Performance', 'Attribute'] },
    ],
  },
  {
    id: 'constraint-status2', name: 'Status2 over Status for Orders', category: 'CONSTRAINT',
    rules: [
      { id: 'x-st2-1', text: 'ALWAYS use csord__Status2__c for order status queries. csord__Status__c never transitions — shows all 42,708 orders as "In Provisioning". This is a Maxis-specific data model quirk.', tags: ['Status2', 'ProductOrder', 'DataModel'] },
    ],
  },
  {
    id: 'constraint-zero-join-service', name: 'Zero-JOIN Service View', category: 'CONSTRAINT',
    rules: [
      { id: 'x-zj-1', text: 'Service view (321K records) uses zero JOINs. All enrichment via direct fields or client-side resolution. Deliberately avoids Subscription/Attribute JOINs for FDW performance.', tags: ['Service', 'FDW', 'Performance'] },
    ],
  },
  {
    id: 'constraint-x-fields', name: 'Custom x_* Detection Fields', category: 'CONSTRAINT',
    rules: [
      { id: 'x-xf-1', text: 'Detection flags exposed as custom x_* fields (x_has1867Issue, x_migratedData, x_billingAccountId, etc.) on entity views. Enables efficient SOQL-pushdown filtering via the TMF API.', tags: ['Detection', 'x_fields', 'FDW'] },
    ],
  },

  // === BASKET ANALYZER DIAGNOSTICS ===

  {
    id: 'concern-basket-pricing', name: 'Basket Pricing Validation', category: 'CONCERN',
    rules: [
      { id: 'ba-1', text: "If cscfga__Basket_Status__c = 'Req Update' OR cscfga__pricing_status__c != 'Done'/'Complete' OR cscfga__Total_Price__c IS NULL, THEN basket has incomplete pricing. This blocks order submission. SOQL: SELECT Id, Name, cscfga__Basket_Status__c, csordtelcoa__Basket_Stage__c, cscfga__pricing_status__c, cscfga__Total_Price__c, cscfga__total_contract_value__c FROM cscfga__Product_Basket__c WHERE Id = '{id}'", tags: ['Basket', 'Pricing', 'Diagnostics'], source: 'Basket Analyzer' },
    ],
  },
  {
    id: 'concern-solution-integrity', name: 'Solution Configuration Integrity', category: 'CONCERN',
    rules: [
      { id: 'ba-2', text: "If Solution count != Product Configuration count for a basket, OR solutions exist without configurations, OR configurations exist without valid solution association, THEN solution-config integrity is broken. Check: (1) Solutions WHERE cssdm__product_basket__c = '{id}', (2) Product_Configuration WHERE basket_id AND Name LIKE '%Solution%'. Compare cssdm__solution_association__c linkage. Also check for IsDeleted = true ghost records.", tags: ['Solution', 'Configuration', 'Integrity'], source: 'Basket Analyzer' },
    ],
  },
  {
    id: 'concern-duplicate-guids', name: 'Duplicate Configuration GUIDs', category: 'CONCERN',
    rules: [
      { id: 'ba-3', text: "If multiple Product_Configurations in a basket share the same GUID__c value, THEN duplicate GUIDs exist which cause cloning errors. SOQL: SELECT Name, GUID__c FROM cscfga__Product_Configuration__c WHERE cscfga__Product_Basket__c = '{id}'. Group by GUID__c, flag any with count > 1.", tags: ['GUID', 'Duplicate', 'Configuration'], source: 'Basket Analyzer' },
    ],
  },
  {
    id: 'concern-cancelled-items', name: 'Cancelled Items in Basket', category: 'CONCERN',
    rules: [
      { id: 'ba-4', text: "If csordtelcoa__cancelled_by_change_process__c = true on Product_Configurations OR Services in a basket, THEN cancelled items remain and may block processing. Check both cscfga__Product_Configuration__c and csord__Service__c WHERE csordtelcoa__Product_Basket__c = '{id}'.", tags: ['Cancelled', 'MACD', 'ChangeProcess'], source: 'Basket Analyzer' },
    ],
  },
  {
    id: 'concern-order-generation', name: 'Order Generation Process (7-Step)', category: 'CONCERN',
    rules: [
      { id: 'ba-5a', text: "Step A: Basket must have Basket_Stage_UI__c = 'Submitted' for order generation to apply. Also check csordtelcoa__Synchronised_with_Opportunity__c and csordtelcoa__Order_Generation_Batch_Job_Id__c.", tags: ['OrderGeneration', 'Basket', 'Stage'], source: 'Basket Analyzer' },
      { id: 'ba-5b', text: "Step B: Query csord__Service__c WHERE csordtelcoa__Product_Basket__c = '{id}'. If zero service records, order generation hasn't progressed.", tags: ['OrderGeneration', 'Service', 'Check'], source: 'Basket Analyzer' },
      { id: 'ba-5c', text: "Step C: Query csord__Solution__c WHERE basket_id AND csord__Order__c != ''. Compare solutions-with-orders count vs total solutions. Zero orders on submitted basket = order generation failed.", tags: ['OrderGeneration', 'Solution', 'Order'], source: 'Basket Analyzer' },
      { id: 'ba-5d', text: "Step D: If Order_Generation_Batch_Job_Id__c exists, check AsyncApexJob: SELECT Status, NumberOfErrors FROM AsyncApexJob WHERE Id = '{job_id}'. Failed status or NumberOfErrors > 0 = Apex error.", tags: ['OrderGeneration', 'ApexJob', 'Error'], source: 'Basket Analyzer' },
      { id: 'ba-5e', text: "Step E: If no Apex errors, check application logs: SELECT FROM Log__c WHERE Class__c = 'AfterOrderGenerationObserverHelper' AND createddate = today ORDER BY CreatedDate DESC LIMIT 10. Error-level or exception logs indicate post-generation failures.", tags: ['OrderGeneration', 'Logs', 'Observer'], source: 'Basket Analyzer' },
    ],
  },
  {
    id: 'concern-replaced-solution-mismatch', name: 'Replaced Solution Mismatch (AN11)', category: 'CONCERN',
    rules: [
      { id: 'ba-6', text: "Check for product configurations where the solution association's replaced solution differs from the replaced product configuration's solution association. This AN11 pattern indicates MACD replacement chain inconsistency.", tags: ['MACD', 'Replacement', 'AN11'], source: 'Basket Analyzer' },
    ],
  },

  // === BASKET ANALYZER SKILLS ===

  {
    id: 'skill-basket-diagnostics', name: 'Basket Diagnostics Workflow', category: 'SKILL',
    rules: [
      { id: 'ba-s1', text: "Full basket investigation: (1) Extract basket_id from support ticket, (2) Run 9 diagnostic SOQL checks (pricing, solution integrity, duplicate GUIDs, cancelled items, order generation 5-step), (3) Search CloudWatch logs for correlation IDs and errors, (4) Generate structured report with issue areas and remediation recommendations.", tags: ['Diagnostics', 'Workflow', 'Support'], source: 'Basket Analyzer' },
    ],
  },
  {
    id: 'skill-cloudwatch-investigation', name: 'CloudWatch Log Investigation', category: 'SKILL',
    rules: [
      { id: 'ba-s2', text: "For basket issues: (1) Accept basket_id, (2) Search CloudWatch logs at /aws/ecs/SolutionManagementServiceStack-prod for entries containing the basket ID, (3) Identify correlation IDs from log entries, (4) Scan for error messages, failure statuses, exceptions, stack traces, timeout indicators, and retry patterns, (5) Summarize findings with potential root cause.", tags: ['CloudWatch', 'Logs', 'Investigation'], source: 'Basket Analyzer' },
    ],
  },

  // === EXTERNAL SYSTEM DOMAINS ===

  {
    id: 'domain-kayako', name: 'Kayako (Support Tickets)', category: 'DOMAIN',
    rules: [
      { id: 'ba-d1', text: "Kayako at central-supportdesk.kayako.com provides support ticket management. Available operations: Get Ticket, Get Conversations, Get Timeline, Get All Ticket Data, Get Ticket Triage, Reply to Ticket. Basket IDs are extracted from ticket triage details (always start with a0u). If no basket ID found, try solution ID and reverse-lookup.", tags: ['Kayako', 'Support', 'Tickets'] },
    ],
  },
  {
    id: 'domain-cloudwatch', name: 'AWS CloudWatch (Runtime Logs)', category: 'DOMAIN',
    rules: [
      { id: 'ba-d2', text: "CloudWatch logs at log group /aws/ecs/SolutionManagementServiceStack-prod-apac provide runtime execution traces. Accessed via cross-account role arn:aws:iam::861276110329:role/CrossAccountCloudWatchAccess. Used to trace basket processing errors, order generation failures, and Apex job execution issues.", tags: ['CloudWatch', 'AWS', 'Logs'] },
    ],
  },
  {
    id: 'domain-sm-database', name: 'Solution Management Database', category: 'DOMAIN',
    rules: [
      { id: 'ba-d3', text: "The SM (Solution Management) Heroku PostgreSQL database stores migrated solution data, product basket configurations, and order snapshots. Accessed via the Salesforce API component for basket diagnostics, failed basket retrieval, and snapshot analysis. Key entities: baskets, solutions, configurations, orders.", tags: ['SM', 'Database', 'Heroku'] },
    ],
  },
];

export default function SemanticModelPage() {
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | TagCategory>('All');

  const toggleTag = (id: string) => {
    setExpandedTags(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedTags(new Set(filtered.map(t => t.id)));
  const collapseAll = () => setExpandedTags(new Set());

  const filtered = SEMANTIC_TAGS.filter(tag => {
    if (categoryFilter !== 'All' && tag.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return tag.name.toLowerCase().includes(q) ||
        tag.rules.some(r => r.text.toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q)));
    }
    return true;
  });

  const counts = {
    tags: filtered.length,
    rules: filtered.reduce((sum, t) => sum + t.rules.length, 0),
    system: SEMANTIC_TAGS.length - filtered.length,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-slate-600" />
          <h1 className="text-xl font-bold text-slate-900">Semantic Model</h1>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 font-medium">
          <Plus className="w-4 h-4" /> New Tag
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
          />
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-500">Category:</span>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value as 'All' | TagCategory)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-purple-400"
          >
            <option value="All">All</option>
            <option value="DOMAIN">Domain</option>
            <option value="CONCERN">Concern</option>
            <option value="SKILL">Skill</option>
            <option value="CONSTRAINT">Constraint</option>
          </select>
        </div>
      </div>

      {/* Stats + expand/collapse */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">
          {counts.tags} tags, {counts.rules} rules
          {counts.system > 0 && <span className="text-slate-400"> (+{counts.system} filtered)</span>}
        </span>
        <div className="flex items-center gap-3 text-xs">
          <button onClick={expandAll} className="text-slate-500 hover:text-slate-700">Expand All</button>
          <button onClick={collapseAll} className="text-slate-500 hover:text-slate-700">Collapse All</button>
        </div>
      </div>

      {/* Tag tree */}
      <div className="space-y-1">
        {filtered.map(tag => {
          const isExpanded = expandedTags.has(tag.id);
          const colors = CATEGORY_COLORS[tag.category];

          return (
            <div key={tag.id}>
              <button
                onClick={() => toggleTag(tag.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left transition-colors group"
              >
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                }
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shrink-0 ${colors.bg}`}>
                  {tag.category}
                </span>
                <span className="font-medium text-slate-900 text-sm">{tag.name}</span>
                <span className="ml-auto text-xs text-slate-400 shrink-0">{tag.rules.length} rule{tag.rules.length !== 1 ? 's' : ''}</span>
              </button>

              {isExpanded && (
                <div className="ml-10 mb-2 space-y-2">
                  {tag.rules.map(rule => (
                    <div key={rule.id} className="bg-white border border-slate-200 rounded-lg px-4 py-3">
                      <p className="text-sm text-slate-700 leading-relaxed">{rule.text}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {rule.tags.map(t => (
                          <span key={t} className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] rounded-full font-medium border border-purple-100">
                            {t}
                          </span>
                        ))}
                        {rule.source && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-full font-medium border border-blue-100">
                            Source: {rule.source}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tags match your search.</p>
        </div>
      )}
    </div>
  );
}
