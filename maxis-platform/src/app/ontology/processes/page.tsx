'use client';

import { ArrowRight, ArrowDown, Users, Wallet, ShoppingCart, FileText, Package, Server, Cog, AlertTriangle } from 'lucide-react';

const O2A_STEPS = [
  { step: 1, name: 'Customer Onboarding', etom: 'Fulfillment > CRM Support', csObject: 'Account + Contact', tmf: 'TMF632 Organization + Individual', description: 'Enterprise customer identity created; contacts (PIC) assigned', icon: Users, color: 'bg-blue-500', records: '~50K + ~80K' },
  { step: 2, name: 'Financial Setup', etom: 'Billing > Account Mgmt', csObject: 'csconta__Billing_Account__c', tmf: 'TMF666 BillingAccount', description: 'Payment account created; linked to Account + Contact (PIC)', icon: Wallet, color: 'bg-blue-500', records: '~120K' },
  { step: 3, name: 'Product Selection', etom: 'Fulfillment > Selling', csObject: 'Product_Basket__c + Product_Configuration__c', tmf: 'TMF663 ShoppingCart + CartItem', description: 'Sales agent configures bundle (Mobile, Fibre, add-ons, devices) in basket', icon: ShoppingCart, color: 'bg-purple-500', records: '~200K + 618K' },
  { step: 4, name: 'Order Commitment', etom: 'Fulfillment > Order Handling', csObject: 'csord__Order__c', tmf: 'TMF622 ProductOrder', description: 'Customer commits; credit check -> order submitted -> fulfillment triggered', icon: FileText, color: 'bg-purple-500', records: '~150K' },
  { step: 5, name: 'Agreement Creation', etom: 'Fulfillment > Order Handling', csObject: 'csord__Solution__c', tmf: 'TMF637 Product (Agreement)', description: 'Long-lived commercial container created; holds pricing (TCV/RC/OTC), contract term', icon: Package, color: 'bg-amber-500', records: '~520K' },
  { step: 6, name: 'Service Activation', etom: 'Fulfillment > Service Config & Activation', csObject: 'csord__Service__c', tmf: 'TMF638 Service', description: 'Technical services provisioned: Voice, Fibre, eSMS, Access; MSISDN/SIM/Circuit assigned', icon: Server, color: 'bg-amber-500', records: '321K' },
  { step: 7, name: 'Ongoing Operations', etom: 'Assurance > Operations Support', csObject: 'CSPOFA Orchestration Process/Step', tmf: 'TMF653 TaskFlow/Task (not deployed)', description: 'Automated orchestration: provisioning, MNP port-in, MACD, Tertio callbacks', icon: Cog, color: 'bg-slate-400', records: '526K + 5.7M' },
  { step: 8, name: 'Data Quality Assurance', etom: 'Assurance > Service Problem Mgmt', csObject: 'tmf.serviceProblem + AsyncApexJob', tmf: 'TMF656 ServiceProblem + EventRecord', description: '1147/1867 issue detection, batch remediation tracking, resolution audit', icon: AlertTriangle, color: 'bg-red-500', records: 'Dynamic' },
];

const BSS_PROCESSES = [
  {
    id: 'P1', name: 'Issue Detection', etom: '1.2.6 - Service Problem Management',
    steps: [
      { name: '1147: Solution Empty', detail: 'product_basket__c IS NULL AND CreatedBy = Migration User', view: 'product.sql' },
      { name: '1867: Partial OE Data', detail: 'Migrated + Service_Type IN scope + no Replacement', view: 'service.sql' },
      { name: 'Failed Migration', detail: "External_Identifier = 'Not Migrated Successfully'", view: 'failedMigrationSolutions.sql' },
    ],
  },
  {
    id: 'P2', name: 'Service Problem Lifecycle', etom: '1.2.6.1 - Problem Reporting',
    steps: [
      { name: 'Create', detail: 'status: pending - Issue detected, awaiting remediation', view: 'serviceProblem.sql' },
      { name: 'In Progress', detail: 'Remediation started via Batch Orchestrator', view: 'serviceProblem.sql' },
      { name: 'Resolved', detail: 'Remediation completed successfully', view: 'serviceProblem.sql' },
      { name: 'Rejected', detail: 'Remediation failed or skipped (MACD safety)', view: 'serviceProblem.sql' },
    ],
  },
  {
    id: 'P3', name: 'Solution Remediation (1147)', etom: '1.2.6.3 - Problem Resolution',
    steps: [
      { name: 'VALIDATE', detail: 'GET /solutionInfo/{id} - MACD eligibility check', view: 'rest_foreign_tables.sql' },
      { name: 'DELETE', detail: 'DELETE /solutionMigration/{id} - Clean SM artifacts', view: 'rest_foreign_tables.sql' },
      { name: 'MIGRATE', detail: 'POST /solutionMigration - Trigger re-migration', view: 'rest_foreign_tables.sql' },
      { name: 'POLL', detail: 'GET /migrationStatus/{id} - Exponential backoff', view: 'rest_foreign_tables.sql' },
      { name: 'POST_UPDATE', detail: 'PATCH /solutionPostUpdate - Set migration flags', view: 'rest_foreign_tables.sql' },
    ],
  },
  {
    id: 'P4', name: 'OE Remediation (1867)', etom: '1.2.6.3 - Problem Resolution',
    steps: [
      { name: 'FETCH', detail: 'GET /oeServiceInfo/{id} - Service + OE data', view: 'oe_foreign_tables.sql' },
      { name: 'ANALYZE', detail: 'Identify missing mandatory fields per service type', view: '(internal logic)' },
      { name: 'PATCH', detail: 'PUT /oeServiceAttachment/{id} - Update OE JSON', view: 'oe_foreign_tables.sql' },
      { name: 'SYNC', detail: 'POST /oeServiceRemediation/{id} - Verify consistency', view: 'oe_foreign_tables.sql' },
    ],
  },
];

export default function ProcessesPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Cog className="w-6 h-6 text-slate-600" /> eTOM Process Map
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Maxis Order-to-Activate lifecycle mapped to eTOM standards and BSS Magic operational processes
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Order-to-Activate Lifecycle (Steps 1-8)</h2>
        <p className="text-xs text-slate-400 mb-4">Steps 1-6: Standard Maxis O2A managed by CloudSense | Steps 7-8: BSS Magic operational/assurance domain</p>

        <div className="grid grid-cols-4 gap-3">
          {O2A_STEPS.map((step, i) => (
            <div key={step.step} className={`rounded-lg border p-4 ${step.step >= 7 ? 'border-dashed border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-full ${step.color} text-white flex items-center justify-center text-xs font-bold`}>{step.step}</div>
                <step.icon className="w-4 h-4 text-slate-500" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">{step.name}</h3>
              <p className="text-[11px] text-slate-600 mb-2">{step.description}</p>
              <div className="space-y-1 text-[10px]">
                <div className="text-slate-400">eTOM: <span className="text-slate-600">{step.etom}</span></div>
                <div className="text-slate-400">CS: <span className="font-mono text-slate-600">{step.csObject}</span></div>
                <div className="text-slate-400">TMF: <span className="text-purple-600">{step.tmf}</span></div>
                <div className="text-slate-400">Records: <span className="font-mono text-slate-700">{step.records}</span></div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-6 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500" /> Customer Domain</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-500" /> Sales / Commercial</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500" /> Fulfillment</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500" /> BSS Magic (Assurance)</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-400 border border-dashed border-slate-500" /> Not Yet Deployed</div>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">BSS Magic Operational Processes (P1-P4)</h2>
        <p className="text-xs text-slate-400">eTOM: Service Problem Management (1.2.6) and Problem Resolution (1.2.6.3)</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {BSS_PROCESSES.map(proc => (
          <div key={proc.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-purple-400 font-mono font-bold text-sm">{proc.id}</span>
                <h3 className="text-white font-semibold text-sm">{proc.name}</h3>
              </div>
              <div className="text-slate-400 text-[10px] mt-0.5">{proc.etom}</div>
            </div>
            <div className="p-4 space-y-2">
              {proc.steps.map((step, i) => (
                <div key={i}>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 text-sm">{step.name}</div>
                      <div className="text-xs text-slate-500">{step.detail}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{step.view}</div>
                    </div>
                  </div>
                  {i < proc.steps.length - 1 && (
                    <div className="flex justify-start pl-2.5 py-0.5">
                      <ArrowDown className="w-3 h-3 text-slate-300" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
