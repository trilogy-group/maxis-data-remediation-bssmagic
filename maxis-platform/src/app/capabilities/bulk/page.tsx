'use client';

import { useQuery } from '@tanstack/react-query';
import { queryTMF, getOrchestratorStatus, ORCHESTRATOR_URL } from '@/lib/api';
import { PlayCircle, CheckCircle, XCircle, Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

type WizardStep = 'select' | 'configure' | 'execute' | 'validate';

const STEPS: { key: WizardStep; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'select', label: 'Select', icon: AlertTriangle },
  { key: 'configure', label: 'Configure', icon: Clock },
  { key: 'execute', label: 'Execute', icon: PlayCircle },
  { key: 'validate', label: 'Validate', icon: CheckCircle },
];

export default function BulkPage() {
  const [step, setStep] = useState<WizardStep>('select');
  const [issueType, setIssueType] = useState('SolutionEmpty');
  const [concurrency, setConcurrency] = useState(15);
  const [dryRun, setDryRun] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const { data: issues } = useQuery({
    queryKey: ['bulk-issues', issueType],
    queryFn: () => queryTMF('/tmf-api/serviceProblemManagement/v5/serviceProblem', {
      category: issueType,
      status: 'pending',
      limit: '200',
    }),
    enabled: step === 'select',
  });

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const endpoint = issueType === 'PartialDataMissing'
        ? `${ORCHESTRATOR_URL}/oe/batch-check`
        : `${ORCHESTRATOR_URL}/execute`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_count: (issues as unknown[])?.length ?? 50, dry_run: dryRun }),
      });
      setResult(await res.json());
      setStep('validate');
    } catch (e) {
      setResult({ error: (e as Error).message });
      setStep('validate');
    } finally {
      setExecuting(false);
    }
  };

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <PlayCircle className="w-6 h-6 text-slate-600" /> Bulk Remediation
        </h1>
        <p className="text-slate-500 text-sm mt-1">Guided workflow for batch issue resolution</p>
      </div>

      <div className="flex items-center gap-2 mb-8 bg-white rounded-xl border border-slate-200 p-4">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <button
              onClick={() => i <= currentStepIndex && setStep(s.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                s.key === step ? 'bg-purple-600 text-white' :
                i < currentStepIndex ? 'bg-green-100 text-green-700' :
                'bg-slate-100 text-slate-400'
              }`}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
            </button>
            {i < STEPS.length - 1 && <ArrowRight className="w-4 h-4 text-slate-300" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {step === 'select' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Select Issue Type</h2>
            <div className="grid grid-cols-2 gap-4">
              {['SolutionEmpty', 'PartialDataMissing', 'MigrationFailed', 'BillingAccountMissing'].map(type => (
                <button
                  key={type}
                  onClick={() => setIssueType(type)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    issueType === type ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-slate-900">{type}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {type === 'SolutionEmpty' && '1147: Solutions missing Product Basket'}
                    {type === 'PartialDataMissing' && '1867: OE JSON missing mandatory fields'}
                    {type === 'MigrationFailed' && 'Solutions stuck in "Not Migrated Successfully"'}
                    {type === 'BillingAccountMissing' && 'Services without Billing Account link'}
                  </div>
                </button>
              ))}
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
              {issues ? `${(issues as unknown[]).length} pending issues match this category` : 'Loading...'}
            </div>
            <button onClick={() => setStep('configure')} disabled={!issues || (issues as unknown[]).length === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
              Next: Configure
            </button>
          </div>
        )}

        {step === 'configure' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Configure Execution</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Concurrency</label>
                <input type="range" min={1} max={50} value={concurrency} onChange={e => setConcurrency(+e.target.value)}
                  className="w-full" />
                <div className="text-xs text-slate-500 mt-1">{concurrency} parallel operations</div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} className="rounded" />
                  Dry run (simulate without changes)
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('select')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">Back</button>
              <button onClick={() => { setStep('execute'); handleExecute(); }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                Execute Batch
              </button>
            </div>
          </div>
        )}

        {step === 'execute' && (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900">Executing Batch Remediation...</h2>
            <p className="text-sm text-slate-500 mt-1">Processing {(issues as unknown[])?.length ?? 0} issues with concurrency {concurrency}</p>
          </div>
        )}

        {step === 'validate' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              {result && !('error' in result)
                ? <><CheckCircle className="w-5 h-5 text-green-500" /> Batch Complete</>
                : <><XCircle className="w-5 h-5 text-red-500" /> Batch Failed</>
              }
            </h2>
            <pre className="bg-slate-50 rounded-lg p-4 text-xs font-mono text-slate-700 overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
            <button onClick={() => { setStep('select'); setResult(null); }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium">
              Start New Batch
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
