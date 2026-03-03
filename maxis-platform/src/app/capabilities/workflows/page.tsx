'use client';

import { WORKFLOWS } from '@/lib/workflows-data';
import { GitBranch, ArrowDown, CheckCircle, XCircle, Clock, Shield, BarChart3 } from 'lucide-react';
import { useState } from 'react';

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-700 border-green-200',
  POST: 'bg-blue-100 text-blue-700 border-blue-200',
  DELETE: 'bg-red-100 text-red-700 border-red-200',
  PATCH: 'bg-orange-100 text-orange-700 border-orange-200',
  PUT: 'bg-purple-100 text-purple-700 border-purple-200',
};

export default function WorkflowsPage() {
  const [activeWorkflow, setActiveWorkflow] = useState(WORKFLOWS[0].id);
  const workflow = WORKFLOWS.find(w => w.id === activeWorkflow)!;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-slate-600" /> Remediation Workflows
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Step-by-step remediation flows for Maxis CloudSense issue resolution
        </p>
      </div>

      <div className="flex gap-3 mb-6">
        {WORKFLOWS.map(w => (
          <button
            key={w.id}
            onClick={() => setActiveWorkflow(w.id)}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeWorkflow === w.id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            {w.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
            <h2 className="font-semibold text-slate-900 mb-2">{workflow.name}</h2>
            <p className="text-sm text-slate-600 mb-3">{workflow.description}</p>
            <div className="flex gap-4 text-xs text-slate-500">
              <span><strong>Trigger:</strong> <code className="bg-slate-100 px-1.5 py-0.5 rounded">{workflow.trigger}</code></span>
              <span><strong>Issue Type:</strong> <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full">{workflow.issueType}</span></span>
            </div>
          </div>

          {workflow.steps.map((step, i) => (
            <div key={step.id}>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4 p-5">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900 text-lg">{step.name}</h3>
                      <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded border ${METHOD_COLORS[step.method]}`}>
                        {step.method}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />{step.duration}
                      </span>
                    </div>
                    <code className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded block mb-2 font-mono">{step.endpoint}</code>
                    <p className="text-sm text-slate-600 mb-2">{step.description}</p>
                    <div className="flex items-start gap-1.5 text-xs">
                      <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      <span className="text-red-600">{step.onFailure}</span>
                    </div>
                  </div>
                </div>
              </div>
              {i < workflow.steps.length - 1 && (
                <div className="flex justify-center py-1.5">
                  <ArrowDown className="w-5 h-5 text-slate-300" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" /> Performance
            </h3>
            <div className="space-y-3">
              {workflow.metrics.map(m => (
                <div key={m.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{m.label}</span>
                  <span className="font-medium text-slate-900">{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" /> Safety Rules
            </h3>
            <ul className="space-y-2">
              {workflow.safetyRules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-900 rounded-xl p-5 text-white">
            <h3 className="font-semibold mb-3">Architecture Path</h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-slate-700 rounded">Dashboard</span>
                <span className="text-slate-500">→</span>
                <span className="px-1.5 py-0.5 bg-slate-700 rounded">Orchestrator :8082</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-slate-700 rounded">Orchestrator</span>
                <span className="text-slate-500">→</span>
                <span className="px-1.5 py-0.5 bg-slate-700 rounded">TMF API (ALB)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-slate-700 rounded">TMF Server</span>
                <span className="text-slate-500">→</span>
                <span className="px-1.5 py-0.5 bg-slate-700 rounded">REST FDW</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-slate-700 rounded">REST FDW</span>
                <span className="text-slate-500">→</span>
                <span className="px-1.5 py-0.5 bg-purple-700 rounded">Salesforce Apex</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
