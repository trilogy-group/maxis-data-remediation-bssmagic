'use client';

import { Fragment, useMemo, useState } from 'react';
import { useCloudSenseHealth, useAnalyzedConfigurations, usePatchOEService } from '@/hooks/useCloudSense';
import { Spinner } from '@/components/ui/loader';
import { cn } from '@/lib/utils';
import {
  useService1867VoiceList,
  useService1867FibreList,
  useService1867EsmsList,
  useService1867AccessList,
  usePicEmailLookup,
} from '@/tmf/working-apis/hooks';
import type { Service } from '@/tmf/working-apis/api';

// Sample baskets for testing - in production these would come from TMF API
const SAMPLE_BASKETS = [
  { id: 'a0uMS000001cuS1YAI', name: 'New Basket 2025-12-10', solution: 'Mobile Solution' },
];

// Temporary fallback: 1867 scenario candidates seeded from SOQL validation.
// We keep these static until the runtime exposes /solution1867* endpoints.
type ScenarioCandidateRow = {
  solutionId: string;
  solutionName: string;
  solutionDefinitionName: string;
  basketId: string;
  basketName: string;
  basketStageUI: string;
  basketStatus: string;
  /**
   * Optional override for what should be sent as CloudSense gateway `solution_name`.
   * Some Solution Console flows expect the solution record name (default),
   * while others only work with the solution definition name.
   */
  cloudsenseSolutionName?: string;
};

function normalizeCandidateRows(input: unknown): ScenarioCandidateRow[] {
  // TMF server endpoints *should* return arrays for list calls, but we have seen
  // some custom endpoints return a single object when only one row matches.
  // Be resilient so the UI still renders.
  const unwrapped: unknown =
    // common wrappers
    (input as any)?.items ??
    (input as any)?.data ??
    input;

  const arr: any[] = Array.isArray(unwrapped)
    ? (unwrapped as any[])
    : unwrapped && typeof unwrapped === 'object'
      ? [unwrapped as any]
      : [];

  return arr.map((c: any) => ({
    solutionId: String(c?.solutionId ?? c?.id ?? ''),
    solutionName: String(c?.solutionName ?? ''),
    solutionDefinitionName: String(c?.solutionDefinitionName ?? ''),
    basketId: String(c?.basketId ?? ''),
    basketName: String(c?.basketName ?? ''),
    basketStageUI: String(c?.basketStageUI ?? '—'),
    basketStatus: String(c?.basketStatus ?? '—'),
  }));
}

type ScenarioType =
  | 'fibre-voice'
  | 'fibre-only'
  | 'mobile-esms'
  | 'access-voice'
  | 'manual';

type ScenarioCheck = {
  label: string;
  expected?: string;
  source?: string;
  actual?: string;
  ok: boolean;
};

function normalizeAttrName(name: string): string {
  return (name || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
}

function extractAllAttributes(data: any): Array<{ name: string; value: string; displayValue?: string }> {
  const attrs: Array<{ name: string; value: string; displayValue?: string }> = [];
  const configs = data?.configurations ?? [];
  for (const cfg of configs) {
    for (const oe of cfg.orderEnrichmentList ?? []) {
      for (const a of oe.attributes ?? []) {
        attrs.push({
          name: String(a.name ?? ''),
          value: String(a.value ?? ''),
          displayValue: a.displayValue ? String(a.displayValue) : undefined,
        });
      }
    }
  }
  return attrs;
}

function findAttrValue(
  attrs: Array<{ name: string; value: string; displayValue?: string }>,
  keys: string[],
): string | undefined {
  const keySet = new Set(keys.map(normalizeAttrName));
  // Prefer non-empty values; fall back to displayValue if value is empty.
  for (const a of attrs) {
    if (!keySet.has(normalizeAttrName(a.name))) continue;
    const v = (a.value ?? '').trim();
    if (v) return v;
    const dv = (a.displayValue ?? '').trim();
    if (dv) return dv;
  }
  // If everything is empty, return empty string to show "present but empty"
  for (const a of attrs) {
    if (!keySet.has(normalizeAttrName(a.name))) continue;
    return (a.value ?? a.displayValue ?? '').toString();
  }
  return undefined;
}

function isNonEmpty(v?: string): boolean {
  return Boolean(v && v.trim().length > 0);
}

function isExact(v: string | undefined, expected: string): boolean {
  if (v === undefined) return false;
  return v.trim() === expected;
}

function looksLikeEmail(v?: string): boolean {
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function buildScenarioChecks(scenario: ScenarioType, data: any): ScenarioCheck[] {
  const attrs = extractAllAttributes(data);

  const check = (label: string, actual: string | undefined, ok: boolean, expected?: string, source?: string): ScenarioCheck => ({
    label,
    actual,
    ok,
    expected,
    source,
  });

  if (scenario === 'fibre-voice') {
    const reserved = findAttrValue(attrs, ['ReservedNumber', 'Reserved Number']);
    const resourceSystemGroupId = findAttrValue(attrs, ['ResourceSystemGroupID', 'Resource System Group ID']);
    const numberStatus = findAttrValue(attrs, ['NumberStatus', 'Number Status']);
    const picEmail = findAttrValue(attrs, ['PIC Email', 'PICEmail', 'picemail']);

    return [
      check(
        'Reserved Number',
        reserved,
        isNonEmpty(reserved),
        undefined,
        'Should match csord__Service__c.External_ID__c (voice service)',
      ),
      check('ResourceSystemGroupID', resourceSystemGroupId, isExact(resourceSystemGroupId, 'Migrated'), 'Migrated', "Constant: always 'Migrated'"),
      check('NumberStatus', numberStatus, isExact(numberStatus, 'Reserved'), 'Reserved', "Constant: always 'Reserved'"),
      check(
        'PIC Email',
        picEmail,
        looksLikeEmail(picEmail),
        undefined,
        'Should match Service → Billing_Account__c → Contact__c → Email',
      ),
    ];
  }

  if (scenario === 'fibre-only') {
    const billingAccount = findAttrValue(attrs, ['Billing Account', 'BillingAccount', 'billingaccount']);
    return [
      check(
        'Billing Account',
        billingAccount,
        isNonEmpty(billingAccount),
        undefined,
        'Should match csord__Service__c.Billing_Account__c (fibre service)',
      ),
    ];
  }

  if (scenario === 'mobile-esms') {
    const reserved = findAttrValue(attrs, ['ReservedNumber', 'Reserved Number']);
    const esmsUserName = findAttrValue(attrs, ['eSMSUserName', 'esmsusername', 'eSMS User Name', 'eSMS Username']);
    return [
      check(
        'ReservedNumber',
        reserved,
        isNonEmpty(reserved),
        undefined,
        'Should match csord__Service__c.External_ID__c (ESMS service)',
      ),
      check(
        'eSMSUserName',
        esmsUserName,
        looksLikeEmail(esmsUserName),
        undefined,
        'Should match Service → Billing_Account__c → Contact__c → Email',
      ),
    ];
  }

  if (scenario === 'access-voice') {
    const billingAccount = findAttrValue(attrs, ['Billing Account', 'BillingAccount', 'billingaccount']);
    const picEmail = findAttrValue(attrs, ['PIC Email', 'PICEmail', 'picemail']);
    return [
      check(
        'Billing Account',
        billingAccount,
        isNonEmpty(billingAccount),
        undefined,
        'Should match csord__Service__c.Billing_Account__c (access service)',
      ),
      check(
        'PIC Email',
        picEmail,
        looksLikeEmail(picEmail),
        undefined,
        'Should match Service → Billing_Account__c → Contact__c → Email',
      ),
    ];
  }

  return [];
}

const STATIC_1867_FIBRE_VOICE: ScenarioCandidateRow[] = [
  {
    solutionId: 'a246D000000cXbdQAE',
    solutionName: 'ertewtwet',
    solutionDefinitionName: 'Fibre Solution',
    basketId: 'a0u6D000000lsLoQAI',
    basketName: 'New Basket 2021-01-26 10:17:37',
    basketStageUI: 'Submitted',
    basketStatus: 'Valid',
  },
  {
    solutionId: 'a246D000000cnsfQAA',
    solutionName: 'Bizfibre NI 20210324 1',
    solutionDefinitionName: 'Fibre Solution',
    basketId: 'a0u6D000000mDywQAE',
    basketName: 'Bizfibre NI 2021-03-24 06:41:28',
    basketStageUI: 'Submitted',
    basketStatus: 'Valid',
    // NOTE: historically this basket fails if we send SD ("Fibre Solution").
    // Keep default behavior: send solution record name; SD remains as fallback.
  },
  {
    solutionId: 'a246D000000cotaQAA',
    solutionName: 'Biz Fibre Year End Promo',
    solutionDefinitionName: 'Fibre Solution',
    basketId: 'a0u6D000000mErFQAU',
    basketName: 'BIZ FIBRE YEAR END CAMPAIGN',
    basketStageUI: 'RF Initiated',
    basketStatus: 'Requires Update',
  },
  {
    solutionId: 'a246D000000cqovQAA',
    solutionName: 'BizFibre 500Mbps w BVE',
    solutionDefinitionName: 'Fibre Solution',
    basketId: 'a0u6D000000mGdQQAU',
    basketName: 'New Basket 2021-03-31 06:18:04',
    basketStageUI: 'Order Enrichment',
    basketStatus: 'Requires Update',
  },
  {
    solutionId: 'a246D000000crJZQAY',
    solutionName: 'fibre500',
    solutionDefinitionName: 'Fibre Solution',
    basketId: 'a0u6D000000mH4wQAE',
    basketName: 'New Basket 2021-04-01 07:02:13',
    basketStageUI: 'Submitted',
    basketStatus: 'Valid',
  },
];

const STATIC_1867_FIBRE_ONLY: ScenarioCandidateRow[] = [
  {
    solutionId: 'a246D000000cpBTQAY',
    solutionName: '27210 | MPOWER | FDRV2 | RT1IB | BIZFIBRE | FOE CALLBACK',
    solutionDefinitionName: 'Fibre Solution',
    basketId: 'a0u6D000000mF8BQAU',
    basketName: '27210 | MPOWER | FDRV2 | RT1IB | BIZFIBRE | FOE CALLBACK',
    basketStageUI: 'Submitted',
    basketStatus: 'Valid',
  },
  {
    solutionId: 'a246D000000cxi6QAA',
    solutionName: 'Biz Fibre Renewal Campaign + Wifi MESH FREE',
    solutionDefinitionName: 'Fibre Solution',
    basketId: 'a0u6D000000mQ2OQAU',
    basketName: 'New Basket 2021-04-20 05:53:00',
    basketStageUI: 'Quote Initiated',
    basketStatus: 'Requires Update',
  },
  {
    solutionId: 'a246D000000czMhQAI',
    solutionName: 'test',
    solutionDefinitionName: 'Fibre Solution',
    basketId: 'a0u6D000000mRi0QAE',
    basketName: 'New Basket 2021-04-23 06:52:03',
    basketStageUI: 'Submitted',
    basketStatus: 'Valid',
  },
  {
    solutionId: 'a246D000000czQ0QAI',
    solutionName: 'test',
    solutionDefinitionName: 'Fibre Solution',
    basketId: 'a0u6D000000mRk6QAE',
    basketName: 'Removevas_biz_scenario',
    basketStageUI: 'Submitted',
    basketStatus: 'Valid',
  },
  {
    solutionId: 'a246D000000czQVQAY',
    solutionName: 'test',
    solutionDefinitionName: 'Fibre Solution',
    basketId: 'a0u6D000000mRkkQAE',
    basketName: 'New Basket 2021-04-23 07:37:27',
    basketStageUI: 'Submitted',
    basketStatus: 'Valid',
  },
];

const STATIC_1867_MOBILE_ESMS: ScenarioCandidateRow[] = [
  {
    solutionId: 'a246D000000aVanQAE',
    solutionName: 'Mobile Solution - UCR2612 SC1',
    solutionDefinitionName: 'Mobile Solution',
    basketId: 'a0u6D000001G6vWQAS',
    basketName: 'MAC Solution - 2022-12-05 16:54:00',
    basketStageUI: 'Submitted',
    basketStatus: 'Valid',
  },
  {
    solutionId: 'a246D000000abX4QAI',
    solutionName: 'Mobile Solution - ESMS_Without_rebate',
    solutionDefinitionName: 'Mobile Solution',
    basketId: 'a0u6D000001GCD8QAO',
    basketName: 'New Basket 2023-01-10 04:23:33',
    basketStageUI: 'Submitted',
    basketStatus: 'Valid',
  },
  {
    solutionId: 'a246D000000abgzQAA',
    solutionName: 'Mobile Solution - ESMS',
    solutionDefinitionName: 'Mobile Solution',
    basketId: 'a0u6D000001GCOLQA4',
    basketName: 'New Basket 2023-01-11 03:15:50',
    basketStageUI: 'Submitted',
    basketStatus: 'Valid',
  },
  {
    solutionId: 'a246D000000abkuQAA',
    solutionName: 'Mobile Solution - ESMS',
    solutionDefinitionName: 'Mobile Solution',
    basketId: 'a0u6D000001GCPdQAO',
    basketName: 'New Basket 2023-01-11 04:19:15',
    basketStageUI: 'Submitted',
    basketStatus: 'Valid',
  },
  {
    solutionId: 'a246D000000acN9QAI',
    solutionName: 'Mobile Solution - ESMS',
    solutionDefinitionName: 'Mobile Solution',
    basketId: 'a0u6D000001GCcKQAW',
    basketName: 'New Basket 2023-01-12 03:12:20',
    basketStageUI: 'Submitted',
    basketStatus: 'Valid',
  },
];

const STATIC_1867_ACCESS_VOICE: ScenarioCandidateRow[] = [
  {
    solutionId: 'a246D0000008SxRQAU',
    solutionName: 'Access & Voice Solution',
    solutionDefinitionName: 'Access & Voice Solution',
    basketId: 'a0u6D000000CzCeQAK',
    basketName: 'New Basket 2022-05-18 13:12:29',
    basketStageUI: 'Solution Creation',
    basketStatus: '—',
  },
  {
    solutionId: 'a246D0000008T2RQAU',
    solutionName: 'Access & Voice Solution',
    solutionDefinitionName: 'Access & Voice Solution',
    basketId: 'a0u6D000001ATSOQA4',
    basketName: 'New mobile PB',
    basketStageUI: 'Solution Creation',
    basketStatus: 'Valid',
  },
  {
    solutionId: 'a246D0000008TA1QAM',
    solutionName: 'QUOTE_SIP_5CHANNELS',
    solutionDefinitionName: 'Access & Voice Solution',
    basketId: 'a0u6D000000Czq7QAC',
    basketName: 'New Basket 2022-05-19 09:11:26',
    basketStageUI: 'Solution Creation',
    basketStatus: 'Valid',
  },
  {
    solutionId: 'a246D0000008TBYQA2',
    solutionName: 'QUOTE_SIP_30_CHANNELS',
    solutionDefinitionName: 'Access & Voice Solution',
    basketId: 'a0u6D000000Czq7QAC',
    basketName: 'New Basket 2022-05-19 09:11:26',
    basketStageUI: 'Solution Creation',
    basketStatus: 'Valid',
  },
  {
    solutionId: 'a246D000000aIpsQAE',
    solutionName: 'VSATSKYSTREAM',
    solutionDefinitionName: 'Access & Voice Solution',
    basketId: 'a0u6D000001FvPDQA0',
    basketName: 'VSATSKYSTREAM',
    basketStageUI: 'Solution Creation',
    basketStatus: 'Incomplete',
  },
];

interface OEFieldProps {
  name: string;
  value: string;
  displayValue: string;
  isMissing: boolean;
}

function OEField({ name, displayValue, isMissing }: OEFieldProps) {
  return (
    <div className={cn(
      "flex items-center justify-between py-1.5 px-2 rounded",
      isMissing ? "bg-red-50" : "bg-emerald-50"
    )}>
      <span className="text-sm text-gray-700">{name}</span>
      <span className={cn(
        "text-sm font-medium",
        isMissing ? "text-red-600" : "text-emerald-700"
      )}>
        {isMissing ? '❌ MISSING' : displayValue || '✅'}
      </span>
    </div>
  );
}

export function BasketOEAnalysis({
  basketId,
  solutionName,
  fallbackSolutionName,
  scenario,
}: {
  basketId: string;
  solutionName: string;
  fallbackSolutionName?: string;
  scenario?: ScenarioType;
}) {
  const { data, isLoading, error, analysis, totalMissing, hasIssues, refetch, isFetching } = 
    useAnalyzedConfigurations(basketId, solutionName, fallbackSolutionName);
  const scenarioChecks = data?.success && scenario ? buildScenarioChecks(scenario, data) : [];
  const scenarioFailed = scenarioChecks.filter((c) => !c.ok).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
        <Spinner size="md" />
        <span className="ml-3 text-gray-600">Loading OE data (30-60 seconds)...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 font-medium">Error loading OE data</p>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  if (!data?.success) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-amber-700">No OE data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {scenario && scenarioChecks.length > 0 && (
        <div
          className={cn(
            'rounded-lg p-4 border',
            scenarioFailed > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">Scenario Checks</p>
              <p className="text-sm text-gray-600">
                {scenarioFailed > 0 ? `${scenarioFailed} check(s) failing` : 'All checks passing'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Scenario: <span className="font-mono">{scenario}</span>
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {scenarioChecks.map((c) => (
              <div
                key={c.label}
                className={cn(
                  'flex items-start justify-between gap-3 p-2 rounded border',
                  c.ok ? 'bg-white border-emerald-200' : 'bg-white border-red-200',
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{c.label}</p>
                  {c.source && <p className="text-xs text-gray-500">{c.source}</p>}
                </div>
                <div className="text-right">
                  <p className={cn('text-sm font-mono', c.ok ? 'text-emerald-700' : 'text-red-700')}>
                    {c.actual !== undefined && c.actual !== '' ? c.actual : '∅'}
                  </p>
                  {c.expected && (
                    <p className="text-xs text-gray-500">
                      expected: <span className="font-mono">{c.expected}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className={cn(
        "rounded-lg p-4 border",
        hasIssues ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{hasIssues ? '🚨' : '✅'}</span>
            <div>
              <p className="font-semibold text-gray-900">
                {hasIssues 
                  ? `${totalMissing} Missing Field(s) Detected` 
                  : 'All Key Fields Populated'}
              </p>
              <p className="text-sm text-gray-600">
                {data.count} configurations, {analysis.length} OE items analyzed
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            {isFetching && <Spinner size="sm" />}
            Refresh
          </button>
        </div>
      </div>

      {/* OE Analysis Details */}
      <div className="space-y-3">
        {analysis.map((item, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-gray-900">{item.configName}</h4>
                <p className="text-sm text-gray-500">{item.oeName}</p>
              </div>
              {item.missingCount > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  {item.missingCount} missing
                </span>
              )}
            </div>
            <div className="space-y-1">
              {item.keyFields.map((field, fieldIdx) => (
                <OEField key={fieldIdx} {...field} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type ScenarioTableProps = {
  title: string;
  subtitle: string;
  rows: ScenarioCandidateRow[];
  scenario: ScenarioType;
  isGatewayOnline: boolean;
  runtimeStatus?: number;
  runtimePayload?: unknown;
  isLoading?: boolean;
  expandedSolutionId: string | null;
  onToggleExpanded: (solutionId: string, canToggle: boolean) => void;
};

function ScenarioTable({
  title,
  subtitle,
  rows,
  scenario,
  isGatewayOnline,
  runtimeStatus,
  runtimePayload,
  isLoading,
  expandedSolutionId,
  onToggleExpanded,
}: ScenarioTableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
          {isLoading ? '…' : rows.length}
        </span>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Spinner size="sm" />
          Loading from runtime...
        </div>
      )}

      {runtimeStatus && runtimeStatus !== 200 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-amber-800 text-sm font-medium">Runtime returned HTTP {runtimeStatus}</p>
          <p className="text-amber-700 text-xs mt-1">
            If this is <span className="font-mono">404</span>, the TMF server likely hasn’t registered this route (OpenAPI spec/JAR mismatch).
            If it’s <span className="font-mono">500</span>, the route exists but the underlying view/type mapping may be failing.
          </p>
          <details className="mt-2">
            <summary className="text-xs text-amber-700 cursor-pointer">payload</summary>
            <pre className="mt-2 text-[11px] whitespace-pre-wrap text-amber-900 bg-white/60 p-2 rounded">
              {JSON.stringify(runtimePayload, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <div className="overflow-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left font-medium px-3 py-2">Solution</th>
              <th className="text-left font-medium px-3 py-2">Basket</th>
              <th className="text-left font-medium px-3 py-2">Stage</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="text-left font-medium px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((r) => {
              const primarySolutionName = r.cloudsenseSolutionName || r.solutionName;
              const fallbackSolutionName = r.solutionDefinitionName;
              const canSee = Boolean(r.basketId && primarySolutionName) && isGatewayOnline;
              const isExpanded = expandedSolutionId === r.solutionId;

              return (
                <Fragment key={r.solutionId}>
                  <tr className="bg-white">
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{r.solutionName || '—'}</div>
                      <div className="text-xs text-gray-500 font-mono">{r.solutionId || '—'}</div>
                      <div className="text-xs text-gray-500">
                        Definition: <span className="font-medium">{r.solutionDefinitionName || '—'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-gray-900">{r.basketName || '—'}</div>
                      <div className="text-xs text-gray-500 font-mono">{r.basketId || '—'}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.basketStageUI}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.basketStatus}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => onToggleExpanded(r.solutionId, canSee)}
                        disabled={!canSee}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm font-medium border',
                          canSee
                            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed',
                        )}
                        title={isGatewayOnline ? undefined : 'CloudSense JS Gateway not connected'}
                      >
                        {isExpanded ? 'Hide OE Data' : 'See OE Data'}
                      </button>
                      {r.cloudsenseSolutionName && r.cloudsenseSolutionName !== r.solutionName && (
                        <div className="mt-1 text-[11px] text-gray-500">
                          sending: <span className="font-mono">{r.cloudsenseSolutionName}</span>
                        </div>
                      )}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-white">
                      <td colSpan={5} className="px-3 py-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">OE Analysis: {r.solutionName || '—'}</h4>
                            <p className="text-xs text-gray-600 font-mono">
                              basketId={r.basketId || '—'} · solution_name={primarySolutionName || '—'}
                            </p>
                          </div>
                        </div>
                        <BasketOEAnalysis
                          basketId={r.basketId}
                          solutionName={primarySolutionName}
                          fallbackSolutionName={fallbackSolutionName}
                          scenario={scenario}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Attachment Analysis Result Type
type AttachmentAnalysis = {
  success: boolean;
  error?: string;
  attachmentId?: string;
  serviceId?: string;
  serviceName?: string;
  serviceType?: string;
  bodyLength?: number;
  hasAttachment?: boolean;
  content?: Record<string, unknown>;
  analysis?: {
    serviceType: string;
    mandatoryFields: string[];
    missingFields: string[];
    presentFields: Record<string, unknown>;
    has1867Issue: boolean;
    issueCount: number;
    summary: string;
  };
};

// Service Card for 1867 candidates
function Service1867Card({ 
  service, 
  category,
  isExpanded,
  onToggleExpand,
  isGatewayOnline 
}: { 
  service: Service; 
  category: 'voice' | 'fibre' | 'esms' | 'access';
  isExpanded: boolean;
  onToggleExpand: () => void;
  isGatewayOnline: boolean;
}) {
  const [attachmentData, setAttachmentData] = useState<AttachmentAnalysis | null>(null);
  const [isLoadingAttachment, setIsLoadingAttachment] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
  
  // PIC Email lookup - only triggered when user clicks button
  const [fetchPicEmail, setFetchPicEmail] = useState(false);
  
  // Create a service object for lookup (only used when fetchPicEmail is true)
  const picEmailLookup = usePicEmailLookup(fetchPicEmail ? service : undefined);
  
  // Use fetched PIC email if available, fall back to service.x_picEmail
  const effectivePicEmail = picEmailLookup.picEmail || service.x_picEmail;
  const effectiveBillingAccountName = picEmailLookup.billingAccountName || service.x_billingAccountName;
  
  // Patch mutation (no preview needed - use service x_ fields directly!)
  const patchMutation = usePatchOEService();
  
  const missingFields: string[] = [];
  
  // Determine missing fields based on category
  // Use effectivePicEmail only if user has fetched it, otherwise assume missing
  const picEmailForCheck = fetchPicEmail ? effectivePicEmail : service.x_picEmail;
  
  if (category === 'voice') {
    if (!service.x_externalId) missingFields.push('Reserved Number (External_ID__c)');
    if (!picEmailForCheck) missingFields.push('PIC Email');
  } else if (category === 'fibre') {
    if (!service.x_billingAccountId) missingFields.push('Billing Account');
  } else if (category === 'esms') {
    if (!service.x_externalId) missingFields.push('Reserved Number (External_ID__c)');
    if (!picEmailForCheck) missingFields.push('eSMS UserName (PIC Email)');
  } else if (category === 'access') {
    if (!service.x_billingAccountId) missingFields.push('Billing Account');
    if (!picEmailForCheck) missingFields.push('PIC Email');
  }
  
  const hasIssues = missingFields.length > 0;
  
  // Fetch attachment from 1147-gateway
  const fetchAttachment = async () => {
    setIsLoadingAttachment(true);
    setShowAttachment(true);
    try {
      // Proxy through Next.js API to reach 1147-gateway
      const res = await fetch(`/api/gateway-1147/1867/service/${service.id}/attachment`);
      const data = await res.json();
      
      if (!res.ok) {
        setAttachmentData({ 
          success: false, 
          error: data.detail || data.error || `HTTP ${res.status}`,
          serviceId: service.id 
        });
      } else {
        setAttachmentData(data);
      }
    } catch (err: any) {
      setAttachmentData({ 
        success: false, 
        error: err.message || 'Failed to fetch attachment',
        serviceId: service.id 
      });
    } finally {
      setIsLoadingAttachment(false);
    }
  };
  
  return (
    <div className={cn(
      "rounded-lg border p-3 transition-all",
      hasIssues ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm">{hasIssues ? '🚨' : '✅'}</span>
            <h4 className="font-medium text-gray-900 text-sm truncate">{service.name || 'Unknown Service'}</h4>
          </div>
          <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{service.id}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px] font-medium">
              {service.x_serviceType || service.serviceType || 'Unknown'}
            </span>
            {service.x_accountName && (
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                {service.x_accountName}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {hasIssues && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-medium">
              {missingFields.length} missing
            </span>
          )}
          {/* Get OE JSON Button */}
          <button
            onClick={fetchAttachment}
            disabled={isLoadingAttachment}
            className={cn(
              "px-2 py-1 rounded text-[10px] font-medium transition-colors",
              "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-wait"
            )}
          >
            {isLoadingAttachment ? '⏳ Loading...' : '📄 Get OE JSON'}
          </button>
        </div>
      </div>
      
      {/* Detection Details */}
      <div className="mt-2 pt-2 border-t border-gray-200 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">External ID:</span>
          <span className={cn("font-mono", service.x_externalId ? "text-emerald-600" : "text-red-600")}>
            {service.x_externalId || '∅ MISSING'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Billing Account:</span>
          <span className={cn("font-mono", service.x_billingAccountId ? "text-emerald-600" : "text-red-600")}>
            {effectiveBillingAccountName || service.x_billingAccountId || '∅ MISSING'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">PIC Email:</span>
          <div className="flex items-center gap-1">
            {/* Show fetched email if available */}
            {effectivePicEmail ? (
              <span className="font-mono text-emerald-600 truncate max-w-[150px]" title={effectivePicEmail}>
                {effectivePicEmail}
              </span>
            ) : fetchPicEmail && picEmailLookup.isLoading ? (
              <span className="text-gray-400 flex items-center gap-1 text-[10px]">
                <Spinner size="sm" /> Fetching...
              </span>
            ) : fetchPicEmail && picEmailLookup.billingAccountId && !picEmailLookup.contactId ? (
              <span className="text-amber-600 text-[10px]">⚠️ No Contact on BA</span>
            ) : fetchPicEmail && !picEmailLookup.picEmail ? (
              <span className="text-red-600">∅ Not found</span>
            ) : (
              /* Show button to fetch PIC email */
              <button
                onClick={() => setFetchPicEmail(true)}
                className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-[10px] font-medium transition-colors"
                title="Fetch PIC Email via BillingAccount → Contact lookup"
              >
                🔍 Fetch Email
              </button>
            )}
          </div>
        </div>
        {service.x_subscriptionName && (
          <div className="flex justify-between">
            <span className="text-gray-500">Subscription:</span>
            <span className="text-gray-700 truncate max-w-[150px]">{service.x_subscriptionName}</span>
          </div>
        )}
        {service.x_solutionId && (
          <div className="flex justify-between">
            <span className="text-gray-500">Solution:</span>
            <span className="text-gray-700 font-mono text-[10px] truncate max-w-[150px]" title={service.x_solutionId}>
              {service.x_solutionName || service.x_solutionId}
            </span>
          </div>
        )}
      </div>
      
      {/* Missing Fields Alert */}
      {hasIssues && (
        <div className="mt-2 p-2 bg-red-100 rounded text-[10px] text-red-800">
          <strong>Missing for 1867:</strong> {missingFields.join(', ')}
        </div>
      )}
      
      {/* Attachment Result */}
      {showAttachment && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-semibold text-gray-800 text-xs">📄 ProductAttributeDetails.json</h5>
            <button
              onClick={() => setShowAttachment(false)}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕ Close
            </button>
          </div>
          
          {isLoadingAttachment && (
            <div className="flex items-center gap-2 text-xs text-gray-600 py-2">
              <Spinner size="sm" />
              Fetching attachment from Salesforce...
            </div>
          )}
          
          {!isLoadingAttachment && attachmentData && (
            <div className="space-y-2">
              {!attachmentData.success ? (
                <div className="bg-red-100 border border-red-200 rounded p-2 text-xs text-red-800">
                  <strong>Error:</strong> {attachmentData.error}
                  <p className="mt-1 text-[10px] text-red-600">
                    Make sure 1147-gateway is running on port 8081
                  </p>
                </div>
              ) : (
                <>
                  {/* Analysis Summary */}
                  {attachmentData.analysis && (
                    <div className={cn(
                      "rounded p-2 text-xs",
                      attachmentData.analysis.has1867Issue 
                        ? "bg-red-100 border border-red-200" 
                        : "bg-emerald-100 border border-emerald-200"
                    )}>
                      <div className="flex items-center gap-2 font-medium">
                        <span>{attachmentData.analysis.has1867Issue ? '🚨' : '✅'}</span>
                        <span>{attachmentData.analysis.summary}</span>
                      </div>
                      
                      {attachmentData.analysis?.missingFields.length > 0 && (
                        <div className="mt-2">
                          <p className="text-red-700 font-medium">Missing in OE JSON:</p>
                          <ul className="list-disc list-inside text-red-600 text-[10px]">
                            {attachmentData.analysis?.missingFields.map(f => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {Object.keys(attachmentData.analysis.presentFields).length > 0 && (
                        <div className="mt-2">
                          <p className="text-emerald-700 font-medium">Present in OE JSON:</p>
                          <ul className="text-emerald-600 text-[10px] space-y-0.5">
                            {Object.entries(attachmentData.analysis.presentFields).map(([k, v]) => (
                              <li key={k} className="flex gap-1">
                                <span className="font-medium">{k}:</span>
                                <span className="font-mono truncate max-w-[200px]">{String(v)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Auto-Patch Section (Simplified - No Preview API Call!) */}
                  {attachmentData.analysis?.has1867Issue && attachmentData.analysis?.missingFields.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <h5 className="font-semibold text-gray-800 text-xs mb-2">🔧 Auto-Patch</h5>
                      
                      {!patchMutation.isPending && !patchMutation.isSuccess && (
                        <div className="space-y-2">
                          {/* Show what WILL be patched using service x_ fields */}
                          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded">
                            <p className="text-xs font-medium text-emerald-700 mb-2">
                              ✅ Will Patch from Salesforce
                            </p>
                            <div className="space-y-1 text-[10px]">
                              {category === 'voice' && (
                                <>
                                  {attachmentData.analysis?.missingFields.includes('ReservedNumber') && (
                                    <div className="flex justify-between items-center bg-white rounded p-1.5">
                                      <span className="font-mono font-semibold text-emerald-700">ReservedNumber</span>
                                      <span className="font-mono text-gray-900">
                                        {service.x_externalId || '(from Salesforce)'}
                                      </span>
                                    </div>
                                  )}
                                  {attachmentData.analysis?.missingFields.includes('ResourceSystemGroupID') && (
                                    <div className="flex justify-between items-center bg-white rounded p-1.5">
                                      <span className="font-mono font-semibold text-emerald-700">ResourceSystemGroupID</span>
                                      <span className="font-mono text-gray-900">Migrated</span>
                                      <span className="text-[9px] text-gray-400">(hardcoded)</span>
                                    </div>
                                  )}
                                  {attachmentData.analysis?.missingFields.includes('NumberStatus') && (
                                    <div className="flex justify-between items-center bg-white rounded p-1.5">
                                      <span className="font-mono font-semibold text-emerald-700">NumberStatus</span>
                                      <span className="font-mono text-gray-900">Reserved</span>
                                      <span className="text-[9px] text-gray-400">(hardcoded)</span>
                                    </div>
                                  )}
                                  {attachmentData.analysis?.missingFields.includes('PICEmail') && (
                                    <div className="flex justify-between items-center bg-white rounded p-1.5">
                                      <span className="font-mono font-semibold text-emerald-700">PICEmail</span>
                                      <span className="font-mono text-gray-900 truncate max-w-[150px]">
                                        {effectivePicEmail || '(from Salesforce)'}
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                              {category === 'fibre' && (
                                <>
                                  {attachmentData.analysis?.missingFields.includes('BillingAccount') && service.x_billingAccountId && (
                                    <div className="bg-white rounded p-1.5">
                                      <div className="flex justify-between items-center mb-0.5">
                                        <span className="font-mono font-semibold text-emerald-700">BillingAccount</span>
                                      </div>
                                      <div className="text-gray-600">ID: <span className="font-mono text-gray-900">{service.x_billingAccountId}</span></div>
                                      {service.x_billingAccountName && (
                                        <div className="text-gray-600">Name: <span className="text-gray-900">{service.x_billingAccountName}</span></div>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                              {category === 'esms' && (
                                <>
                                  {attachmentData.analysis?.missingFields.includes('ReservedNumber') && service.x_externalId && (
                                    <div className="flex justify-between items-center bg-white rounded p-1.5">
                                      <span className="font-mono font-semibold text-emerald-700">ReservedNumber</span>
                                      <span className="font-mono text-gray-900">{service.x_externalId}</span>
                                    </div>
                                  )}
                                  {attachmentData.analysis?.missingFields.includes('eSMSUserName') && effectivePicEmail && (
                                    <div className="flex justify-between items-center bg-white rounded p-1.5">
                                      <span className="font-mono font-semibold text-emerald-700">eSMSUserName</span>
                                      <span className="font-mono text-gray-900 truncate max-w-[150px]">{effectivePicEmail}</span>
                                    </div>
                                  )}
                                </>
                              )}
                              {category === 'access' && (
                                <>
                                  {attachmentData.analysis?.missingFields.includes('BillingAccount') && service.x_billingAccountId && (
                                    <div className="bg-white rounded p-1.5">
                                      <span className="font-mono font-semibold text-emerald-700">BillingAccount</span>
                                      <div className="text-gray-600 mt-0.5">ID: <span className="font-mono text-gray-900">{service.x_billingAccountId}</span></div>
                                    </div>
                                  )}
                                  {attachmentData.analysis?.missingFields.includes('PICEmail') && effectivePicEmail && (
                                    <div className="flex justify-between items-center bg-white rounded p-1.5">
                                      <span className="font-mono font-semibold text-emerald-700">PICEmail</span>
                                      <span className="font-mono text-gray-900 truncate max-w-[150px]">{effectivePicEmail}</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Patch Button - Build patch data from service x_ fields */}
                          <button
                            onClick={async () => {
                              // Build patch data from service x_ fields (already loaded!)
                              const fieldsToPatch: Array<{fieldName: string; value: string; label?: string}> = [];
                              
                              if (category === 'voice') {
                                // ReservedNumber from External_ID__c
                                if (attachmentData.analysis?.missingFields.includes('ReservedNumber')) {
                                  if (service.x_externalId) {
                                    fieldsToPatch.push({
                                      fieldName: 'ReservedNumber',
                                      value: service.x_externalId,
                                      label: service.x_externalId
                                    });
                                  } else {
                                    // Gateway will fetch from Salesforce if we send empty
                                    fieldsToPatch.push({
                                      fieldName: 'ReservedNumber',
                                      value: '',  // Gateway will fetch
                                      label: ''
                                    });
                                  }
                                }
                                
                                // PICEmail from TMF API chain (BillingAccount -> Individual)
                                if (attachmentData.analysis?.missingFields.includes('PICEmail')) {
                                  if (effectivePicEmail) {
                                    // Use PIC Email from TMF lookup
                                    fieldsToPatch.push({
                                      fieldName: 'PICEmail',
                                      value: effectivePicEmail,
                                      label: effectivePicEmail
                                    });
                                  } else if (!fetchPicEmail) {
                                    // User hasn't fetched yet - prompt them
                                    alert('Please click "🔍 Fetch Email" first to get PIC Email from TMF APIs');
                                    return;
                                  } else {
                                    // Fetched but no email found - let gateway try
                                    fieldsToPatch.push({
                                      fieldName: 'PICEmail',
                                      value: '',  // Gateway will fetch from Salesforce
                                      label: ''
                                    });
                                  }
                                }
                                
                                // ResourceSystemGroupID - always 'Migrated' (gateway will add)
                                if (attachmentData.analysis?.missingFields.includes('ResourceSystemGroupID')) {
                                  fieldsToPatch.push({
                                    fieldName: 'ResourceSystemGroupID',
                                    value: 'Migrated',
                                    label: 'Migrated'
                                  });
                                }
                                
                                // NumberStatus - always 'Reserved' (gateway will add)
                                if (attachmentData.analysis?.missingFields.includes('NumberStatus')) {
                                  fieldsToPatch.push({
                                    fieldName: 'NumberStatus',
                                    value: 'Reserved',
                                    label: 'Reserved'
                                  });
                                }
                              } else if (category === 'fibre') {
                                if (attachmentData.analysis?.missingFields.includes('BillingAccount') && service.x_billingAccountId) {
                                  fieldsToPatch.push({
                                    fieldName: 'BillingAccount',
                                    value: service.x_billingAccountId,
                                    label: effectiveBillingAccountName || undefined  // Name from TMF lookup
                                  });
                                }
                              } else if (category === 'esms') {
                                if (attachmentData.analysis?.missingFields.includes('ReservedNumber') && service.x_externalId) {
                                  fieldsToPatch.push({
                                    fieldName: 'ReservedNumber',
                                    value: service.x_externalId,
                                    label: service.x_externalId
                                  });
                                }
                                // eSMSUserName uses PIC Email from TMF lookup
                                if (attachmentData.analysis?.missingFields.includes('eSMSUserName')) {
                                  if (effectivePicEmail) {
                                    fieldsToPatch.push({
                                      fieldName: 'eSMSUserName',
                                      value: effectivePicEmail,
                                      label: effectivePicEmail
                                    });
                                  } else if (!fetchPicEmail) {
                                    alert('Please click "🔍 Fetch Email" first to get eSMS Username from TMF APIs');
                                    return;
                                  }
                                }
                              } else if (category === 'access') {
                                if (attachmentData.analysis?.missingFields.includes('BillingAccount') && service.x_billingAccountId) {
                                  fieldsToPatch.push({
                                    fieldName: 'BillingAccount',
                                    value: service.x_billingAccountId,
                                    label: effectiveBillingAccountName || undefined  // Name from TMF lookup
                                  });
                                }
                                // PICEmail from TMF API chain
                                if (attachmentData.analysis?.missingFields.includes('PICEmail')) {
                                  if (effectivePicEmail) {
                                    fieldsToPatch.push({
                                      fieldName: 'PICEmail',
                                      value: effectivePicEmail,
                                      label: effectivePicEmail
                                    });
                                  } else if (!fetchPicEmail) {
                                    alert('Please click "🔍 Fetch Email" first to get PIC Email from TMF APIs');
                                    return;
                                  }
                                }
                              }
                              
                              if (fieldsToPatch.length === 0) {
                                alert('No fields can be patched. Salesforce source data is missing.');
                                return;
                              }
                              
                              console.log('📤 Sending patch data from UI:', fieldsToPatch);
                              
                              if (confirm(`Patch ${fieldsToPatch.length} field(s) for service: ${service.name}?\n\nThis will update the attachment directly.`)) {
                                try {
                                  await patchMutation.mutateAsync({ 
                                    serviceId: service.id,
                                    serviceType: service.x_serviceType || 'Unknown',
                                    fieldsToPatch
                                  });
                                } catch (e) {
                                  console.error('Patch failed:', e);
                                }
                              }
                            }}
                            className="w-full py-2 px-3 rounded text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                          >
                            🔧 Patch Missing Fields
                          </button>
                        </div>
                      )}
                      
                      {/* Patching in progress */}
                      {patchMutation.isPending && (
                        <div className="flex items-center justify-center gap-2 py-3">
                          <Spinner size="sm" />
                          <span className="text-xs text-gray-600">Patching OE + updating attachment...</span>
                        </div>
                      )}
                      
                      {/* Success */}
                      {patchMutation.isSuccess && (
                        <div className="p-2 bg-emerald-100 border border-emerald-200 rounded text-xs">
                          <p className="font-medium text-emerald-700">✅ Patched Successfully!</p>
                          <div className="text-emerald-600 text-[10px] mt-1 space-y-0.5">
                            <div>{patchMutation.data?.patchedFields?.length || 0} field(s) updated</div>
                            {patchMutation.data?.attachmentUpdated && (
                              <div>✅ Attachment regenerated (backup created as _old.json)</div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Error */}
                      {patchMutation.isError && (
                        <div className="p-2 bg-red-100 border border-red-200 rounded text-xs">
                          <p className="font-medium text-red-700">❌ Patch Failed</p>
                          <p className="text-red-600 text-[10px] mt-1">{patchMutation.error?.message}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Attachment Metadata */}
                  <div className="text-[10px] text-gray-500">
                    Attachment ID: <span className="font-mono">{attachmentData.attachmentId}</span>
                    {' · '}Size: {attachmentData.bodyLength} bytes
                  </div>
                  
                  {/* Raw JSON Content (collapsible) */}
                  {attachmentData.content && (
                    <details className="mt-1">
                      <summary className="text-[10px] text-blue-600 cursor-pointer hover:underline">
                        View raw OE JSON content
                      </summary>
                      <pre className="mt-1 p-2 bg-gray-900 text-gray-100 rounded text-[9px] overflow-x-auto max-h-[200px] overflow-y-auto">
                        {JSON.stringify(attachmentData.content, null, 2)}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Service Category Panel
function ServiceCategoryPanel({
  title,
  subtitle,
  services,
  category,
  isLoading,
  searchTerm,
  isGatewayOnline,
}: {
  title: string;
  subtitle: string;
  services: Service[];
  category: 'voice' | 'fibre' | 'esms' | 'access';
  isLoading: boolean;
  searchTerm: string;
  isGatewayOnline: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Filter services by search term (matches Service ID, Solution ID, name, account, or subscription)
  const filteredServices = useMemo(() => {
    if (!searchTerm.trim()) return services;
    const term = searchTerm.toLowerCase().trim();
    return services.filter(s => 
      s.id.toLowerCase().includes(term) || 
      (s.name || '').toLowerCase().includes(term) ||
      (s.x_accountName || '').toLowerCase().includes(term) ||
      (s.x_subscriptionName || '').toLowerCase().includes(term) ||
      (s.x_solutionId || '').toLowerCase().includes(term) ||
      (s.x_solutionName || '').toLowerCase().includes(term)
    );
  }, [services, searchTerm]);
  
  // Count services with actual issues (missing mandatory fields)
  const issueCount = useMemo(() => {
    return filteredServices.filter(s => {
      if (category === 'voice') return !s.x_externalId || !s.x_picEmail;
      if (category === 'fibre') return !s.x_billingAccountId;
      if (category === 'esms') return !s.x_externalId || !s.x_picEmail;
      if (category === 'access') return !s.x_billingAccountId || !s.x_picEmail;
      return false;
    }).length;
  }, [filteredServices, category]);
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
            {isLoading ? '…' : filteredServices.length} candidates
          </span>
          {issueCount > 0 && (
            <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
              {issueCount} with issues
            </span>
          )}
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-600 py-4">
          <Spinner size="sm" />
          Loading services...
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="text-center py-4 text-gray-500 text-sm">
          {searchTerm ? `No services matching "${searchTerm}"` : 'No candidate services found'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 max-h-[500px] overflow-y-auto pr-1">
          {filteredServices.map(service => (
            <Service1867Card
              key={service.id}
              service={service}
              category={category}
              isExpanded={expandedId === service.id}
              onToggleExpand={() => setExpandedId(expandedId === service.id ? null : service.id)}
              isGatewayOnline={isGatewayOnline}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function OEPatcherModule() {
  // Search state for filtering across all categories
  const [searchTerm, setSearchTerm] = useState('');
  
  // Manual selection (sample/custom basket analysis)
  const [selectedBasket, setSelectedBasket] = useState<{
    id: string;
    name: string;
    solution: string;
    fallbackSolution?: string;
    scenario?: ScenarioType;
  } | null>(null);
  const [customBasketId, setCustomBasketId] = useState('');
  const [customSolution, setCustomSolution] = useState('');
  
  const health = useCloudSenseHealth();
  const isGatewayOnline = health.data?.status === 'healthy';

  // NEW: Service-based 1867 candidate lists (limit=300)
  const voiceServicesQ = useService1867VoiceList({ limit: 300 });
  const fibreServicesQ = useService1867FibreList({ limit: 300 });
  const esmsServicesQ = useService1867EsmsList({ limit: 300 });
  const accessServicesQ = useService1867AccessList({ limit: 300 });

  // Extract data arrays
  const voiceServices = useMemo(() => voiceServicesQ.data?.data || [], [voiceServicesQ.data]);
  const fibreServices = useMemo(() => fibreServicesQ.data?.data || [], [fibreServicesQ.data]);
  const esmsServices = useMemo(() => esmsServicesQ.data?.data || [], [esmsServicesQ.data]);
  const accessServices = useMemo(() => accessServicesQ.data?.data || [], [accessServicesQ.data]);
  
  // Total counts
  const totalCandidates = voiceServices.length + fibreServices.length + esmsServices.length + accessServices.length;
  const isAnyLoading = voiceServicesQ.isLoading || fibreServicesQ.isLoading || esmsServicesQ.isLoading || accessServicesQ.isLoading;

  return (
    <div className="space-y-6">
      {/* Gateway Status */}
      <div className={cn(
        "rounded-xl p-4 border",
        isGatewayOnline 
          ? "bg-emerald-50 border-emerald-200" 
          : "bg-red-50 border-red-200"
      )}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{isGatewayOnline ? '🔌' : '⚠️'}</span>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">CloudSense API Gateway</h4>
            <p className={isGatewayOnline ? "text-emerald-700" : "text-red-700"}>
              {isGatewayOnline 
                ? 'CloudSense JS Gateway Connected' 
                : 'Gateway not running - Start it to enable OE detection'}
            </p>
            {!isGatewayOnline && (
              <code className="block mt-2 text-xs bg-white/50 p-2 rounded">
                cd "/Users/vladsorici/Downloads/Maxis/bss magic PoC" && source venv/bin/activate && python cloudsense_api_service/main.py
              </code>
            )}
          </div>
          {health.isFetching && <Spinner size="sm" />}
        </div>
      </div>

      {/* 1867 Service Candidates - NEW Service-based detection */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
        <div>
            <h2 className="text-lg font-semibold text-gray-900">1867 Service Candidates</h2>
          <p className="text-sm text-gray-500">
              Migrated services that may have missing OE data. Filter by Service ID, Account, or Subscription name.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-violet-100 text-violet-700">
              {isAnyLoading ? '…' : totalCandidates} total
            </span>
          </div>
        </div>

        {/* Search Input */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔍</span>
            <input
              type="text"
              placeholder="Search by Solution ID, Service ID, Account, or name... (e.g., a246D000000d9gT)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                Clear
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="mt-2 text-xs text-gray-500">
              Filtering across all categories for: <span className="font-mono font-medium">{searchTerm}</span>
            </p>
          )}
        </div>

        {/* 4 Category Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ServiceCategoryPanel
            title="Category 1: Voice Services"
            subtitle="Fibre Solution - Voice Service OE: Check ReservedNumber, PIC Email"
            services={voiceServices}
            category="voice"
            isLoading={voiceServicesQ.isLoading}
            searchTerm={searchTerm}
            isGatewayOnline={isGatewayOnline}
          />
          <ServiceCategoryPanel
            title="Category 2: Fibre Services"
            subtitle="Fibre Solution - Fibre Service OE: Check Billing Account"
            services={fibreServices}
            category="fibre"
            isLoading={fibreServicesQ.isLoading}
            searchTerm={searchTerm}
            isGatewayOnline={isGatewayOnline}
          />
          <ServiceCategoryPanel
            title="Category 3: eSMS Services"
            subtitle="Mobile Solution - ESMS OE: Check ReservedNumber, eSMSUserName"
            services={esmsServices}
            category="esms"
            isLoading={esmsServicesQ.isLoading}
            searchTerm={searchTerm}
            isGatewayOnline={isGatewayOnline}
          />
          <ServiceCategoryPanel
            title="Category 4: Access Services"
            subtitle="Access & Voice Solution - Access OE: Check Billing Account, PIC Email"
            services={accessServices}
            category="access"
            isLoading={accessServicesQ.isLoading}
            searchTerm={searchTerm}
            isGatewayOnline={isGatewayOnline}
          />
        </div>
      </div>

      {/* Manual basket analysis (fallback / debugging) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-1">Manual Basket Analysis</h3>
        <p className="text-sm text-gray-500 mb-4">Use this if you already know a basket ID and solution name.</p>

        {/* Sample Baskets */}
        <div className="space-y-2 mb-4">
          <p className="text-sm text-gray-500">Sample Baskets:</p>
          {SAMPLE_BASKETS.map((basket) => (
            <button
              key={basket.id}
              onClick={() => setSelectedBasket(basket)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all",
                selectedBasket?.id === basket.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <p className="font-medium text-gray-900">{basket.name}</p>
              <p className="text-xs text-gray-500">{basket.solution} • {basket.id}</p>
            </button>
          ))}
        </div>

        {/* Custom Basket Input */}
        <div className="border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-500 mb-2">Or enter custom basket:</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Basket ID"
              value={customBasketId}
              onChange={(e) => setCustomBasketId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              type="text"
              placeholder="Solution Name (e.g., Mobile Solution)"
              value={customSolution}
              onChange={(e) => setCustomSolution(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          {customBasketId && customSolution && (
            <button
              onClick={() =>
                setSelectedBasket({
                  id: customBasketId,
                  name: 'Custom Basket',
                  solution: customSolution,
                  scenario: 'manual',
                })
              }
              disabled={!isGatewayOnline}
              className={cn(
                'mt-2 px-4 py-2 rounded-lg text-sm font-medium',
                isGatewayOnline ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
              title={isGatewayOnline ? undefined : 'CloudSense JS Gateway not connected'}
            >
              Analyze Custom Basket
            </button>
          )}
        </div>
      </div>

      {/* Manual OE Analysis (for Sample/Custom Basket section only) */}
      {selectedBasket && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Manual OE Analysis</h3>
              <p className="text-sm text-gray-500">
                {selectedBasket.name} · <span className="font-mono">{selectedBasket.id}</span>
              </p>
              <p className="text-xs text-gray-600 font-mono">
                solution_name={selectedBasket.solution}
              </p>
            </div>
          </div>

          <BasketOEAnalysis
            basketId={selectedBasket.id}
            solutionName={selectedBasket.solution}
            fallbackSolutionName={selectedBasket.fallbackSolution}
            scenario={selectedBasket.scenario}
          />
        </div>
      )}

      {/* Key Fields Reference */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h4 className="font-semibold text-gray-800 mb-3">📋 1867 - Key OE Fields to Monitor</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-gray-700">Fibre Solution - Voice Service:</p>
            <ul className="text-gray-600 list-disc list-inside">
              <li>ReservedNumber → External_ID__c</li>
              <li>PIC Email → BA→Contact→Email</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-700">Fibre Solution - Fibre Service:</p>
            <ul className="text-gray-600 list-disc list-inside">
              <li>Billing Account → Billing_Account__c</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-700">Mobile Solution - ESMS:</p>
            <ul className="text-gray-600 list-disc list-inside">
              <li>ReservedNumber → External_ID__c</li>
              <li>eSMSUserName → BA→Contact→Email</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-700">Access & Voice:</p>
            <ul className="text-gray-600 list-disc list-inside">
              <li>Billing Account → Billing_Account__c</li>
              <li>PIC Email → BA→Contact→Email</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}


