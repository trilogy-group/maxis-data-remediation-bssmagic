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
