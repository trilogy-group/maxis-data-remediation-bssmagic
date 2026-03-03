import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Database,
  ArrowRight,
  RefreshCw,
  Wrench,
  Eye,
  FileWarning,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useOEServiceInfo,
  useOEPatchAttachment,
  useOETriggerRemediation,
} from '../../services/tmf/hooks';
import { useService, useBillingAccount, useIndividual } from '../../services/tmf/hooks';
import type { OEMissingAttribute, OEServiceInfoResponse } from '../../types/tmf-api';

interface AttachmentAttribute {
  name: string;
  value: string;
  label: string;
}

type AnalysisStep = 'idle' | 'fetching' | 'analyzing' | 'enriching' | 'ready' | 'patching' | 'patched' | 'error';

const MANDATORY_FIELDS: Record<string, string[]> = {
  Voice: ['ReservedNumber', 'ResourceSystemGroupID', 'NumberStatus', 'PICEmail'],
  'Fibre Service': ['BillingAccount'],
  'eSMS Service': ['ReservedNumber', 'eSMSUserName'],
  'Access Service': ['BillingAccount', 'PICEmail'],
};

const OE_SCHEMA_MAPPING: Record<string, string> = {
  Voice: 'Voice OE',
  'Fibre Service': 'Fibre Service OE',
  'eSMS Service': 'eSMS OE',
  'Access Service': 'Access OE',
};

const FIELD_ALIASES: Record<string, string[]> = {
  ReservedNumber: ['ReservedNumber', 'reservedNumber', 'Reserved Number'],
  ResourceSystemGroupID: ['ResourceSystemGroupID', 'resourceSystemGroupID', 'Resource System Group ID'],
  NumberStatus: ['NumberStatus', 'numberStatus', 'Number Status'],
  PICEmail: ['PICEmail', 'picEmail', 'PIC Email', 'PIC_Email'],
  BillingAccount: ['BillingAccount', 'billingAccount', 'Billing Account', 'billing_account'],
  eSMSUserName: ['eSMSUserName', 'esmsUserName', 'eSMS UserName'],
};

function inferServiceType(productDefinitionName: string): string | null {
  const lower = productDefinitionName.toLowerCase();
  if (lower.includes('voice')) return 'Voice';
  if (lower.includes('fibre')) return 'Fibre Service';
  if (lower.includes('esms') || lower.includes('e-sms')) return 'eSMS Service';
  if (lower.includes('access')) return 'Access Service';
  return null;
}

const KNOWN_ENRICHMENT_SOURCES: Record<string, { source: string; description: string }> = {
  'Billing Account': {
    source: 'csord__Service__c.Billing_Account__c',
    description: 'Direct lookup from Service record',
  },
  'BillingAccount': {
    source: 'csord__Service__c.Billing_Account__c',
    description: 'Direct lookup from Service record',
  },
  'PICEmail': {
    source: 'Service → Billing Account → Contact → Individual → Email',
    description: 'Chain lookup through billing relationship',
  },
  'ReservedNumber': {
    source: 'csord__Service__c.External_ID__c',
    description: 'Direct lookup from Service record',
  },
  'ResourceSystemGroupID': {
    source: 'Constant: "Migrated"',
    description: 'Fixed value for migrated services',
  },
  'NumberStatus': {
    source: 'Constant: "Reserved"',
    description: 'Fixed value for reserved numbers',
  },
  'eSMSUserName': {
    source: 'Service → Billing Account → Contact → Individual → Email',
    description: 'Chain lookup through billing relationship',
  },
};

function analyzeAttachment(
  attachmentContent: unknown,
  serviceData: { billingAccountId?: string; billingAccountName?: string; externalId?: string; picEmail?: string },
  productDefinitionName?: string,
): { total: number; populated: number; missing: OEMissingAttribute[]; sections: SectionAnalysis[] } {
  const missing: OEMissingAttribute[] = [];
  const sections: SectionAnalysis[] = [];
  let total = 0;
  let populated = 0;

  if (!attachmentContent || typeof attachmentContent !== 'object') {
    return { total: 0, populated: 0, missing: [], sections: [] };
  }

  const content = attachmentContent as Record<string, unknown>;

  const allNcpAttrNames = new Set<string>();
  const ncpRaw = content['NonCommercialProduct'];
  if (Array.isArray(ncpRaw)) {
    for (const item of ncpRaw) {
      if (typeof item === 'object' && item !== null) {
        for (const [productName, productData] of Object.entries(item as Record<string, unknown>)) {
          const pd = productData as { attributes?: AttachmentAttribute[] };
          const attrs = pd.attributes || [];
          const sectionMissing: OEMissingAttribute[] = [];

          for (const attr of attrs) {
            total++;
            allNcpAttrNames.add(attr.name.toLowerCase().replace(/\s/g, ''));
            const isEmpty = !attr.value || attr.value.trim() === '';
            if (isEmpty) {
              const enrichment = KNOWN_ENRICHMENT_SOURCES[attr.name];
              const resolved = resolveAttributeValue(attr.name, serviceData);

              sectionMissing.push({
                section: 'NonCommercial',
                productName,
                attributeName: attr.name,
                currentValue: attr.value || '',
                currentLabel: attr.label || '',
                resolvedValue: resolved?.value,
                resolvedLabel: resolved?.label,
                resolvedSource: enrichment?.source || 'Unknown',
              });
            } else {
              populated++;
            }
          }

          sections.push({
            section: 'NonCommercial',
            productName,
            totalAttributes: attrs.length,
            populatedAttributes: attrs.length - sectionMissing.length,
            attributes: attrs,
            missingAttributes: sectionMissing,
          });
          missing.push(...sectionMissing);
        }
      }
    }
  }

  if (productDefinitionName) {
    const serviceType = inferServiceType(productDefinitionName);
    if (serviceType) {
      const expectedSchema = OE_SCHEMA_MAPPING[serviceType];
      const schemaNames = Array.isArray(ncpRaw)
        ? (ncpRaw as Record<string, unknown>[]).flatMap(item =>
            typeof item === 'object' && item !== null ? Object.keys(item) : []
          )
        : [];
      const hasSchema = !expectedSchema || schemaNames.some(n => n.toLowerCase().includes(expectedSchema.toLowerCase()));

      if (hasSchema) {
        const required = MANDATORY_FIELDS[serviceType] || [];
        for (const field of required) {
          const aliases = FIELD_ALIASES[field] || [field];
          const found = aliases.some(a => allNcpAttrNames.has(a.toLowerCase().replace(/\s/g, '')));
          if (!found) {
            const enrichment = KNOWN_ENRICHMENT_SOURCES[field];
            const resolved = resolveAttributeValue(field, serviceData);
            total++;
            missing.push({
              section: 'NonCommercial',
              productName: `${serviceType} (mandatory)`,
              attributeName: field,
              currentValue: '',
              currentLabel: '',
              resolvedValue: resolved?.value,
              resolvedLabel: resolved?.label,
              resolvedSource: enrichment?.source || 'Unknown',
            });
          }
        }
      }
    }
  }

  const cpRaw = content['CommercialProduct'];
  if (cpRaw && typeof cpRaw === 'object') {
    const cp = cpRaw as { attributes?: AttachmentAttribute[] };
    const attrs = cp.attributes || [];
    const sectionMissing: OEMissingAttribute[] = [];

    for (const attr of attrs) {
      total++;
      const isEmpty = !attr.value || attr.value.trim() === '';
      if (isEmpty) {
        sectionMissing.push({
          section: 'Commercial',
          productName: 'Commercial Product',
          attributeName: attr.name,
          currentValue: attr.value || '',
          currentLabel: attr.label || '',
          resolvedSource: KNOWN_ENRICHMENT_SOURCES[attr.name]?.source || 'Unknown',
        });
      } else {
        populated++;
      }
    }

    sections.push({
      section: 'Commercial',
      productName: 'Commercial Product',
      totalAttributes: attrs.length,
      populatedAttributes: attrs.length - sectionMissing.length,
      attributes: attrs,
      missingAttributes: sectionMissing,
    });
    missing.push(...sectionMissing);
  }

  return { total, populated, missing, sections };
}

function resolveAttributeValue(
  attributeName: string,
  serviceData: { billingAccountId?: string; billingAccountName?: string; externalId?: string; picEmail?: string }
): { value: string; label: string } | undefined {
  switch (attributeName) {
    case 'Billing Account':
    case 'BillingAccount':
      if (serviceData.billingAccountId) {
        return { value: serviceData.billingAccountId, label: serviceData.billingAccountName || serviceData.billingAccountId };
      }
      return undefined;
    case 'ReservedNumber':
      if (serviceData.externalId) {
        return { value: serviceData.externalId, label: serviceData.externalId };
      }
      return undefined;
    case 'PICEmail':
    case 'eSMSUserName':
      if (serviceData.picEmail) {
        return { value: serviceData.picEmail, label: serviceData.picEmail };
      }
      return undefined;
    case 'ResourceSystemGroupID':
      return { value: 'Migrated', label: 'Migrated' };
    case 'NumberStatus':
      return { value: 'Reserved', label: 'Reserved' };
    default:
      return undefined;
  }
}

interface SectionAnalysis {
  section: 'NonCommercial' | 'Commercial';
  productName: string;
  totalAttributes: number;
  populatedAttributes: number;
  attributes: AttachmentAttribute[];
  missingAttributes: OEMissingAttribute[];
}

function StatusBadge({ status }: { status: 'ok' | 'warning' | 'error' | 'info' }) {
  const styles = {
    ok: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    error: 'bg-red-100 text-red-700 border-red-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  const icons = {
    ok: <CheckCircle2 size={12} />,
    warning: <AlertTriangle size={12} />,
    error: <XCircle size={12} />,
    info: <Info size={12} />,
  };
  const labels = { ok: 'Healthy', warning: 'Issues Found', error: 'Critical', info: 'Info' };

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', styles[status])}>
      {icons[status]}
      {labels[status]}
    </span>
  );
}

function SectionCard({ section, isExpanded, onToggle }: { section: SectionAnalysis; isExpanded: boolean; onToggle: () => void }) {
  const hasMissing = section.missingAttributes.length > 0;

  return (
    <div className={cn(
      'rounded-lg border transition-all',
      hasMissing ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/50'
    )}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-black/5 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
            hasMissing ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'
          )}>
            {section.section === 'NonCommercial' ? 'NC' : 'CP'}
          </div>
          <div>
            <div className="font-medium text-slate-800 text-sm">{section.productName}</div>
            <div className="text-xs text-slate-500">
              {section.populatedAttributes}/{section.totalAttributes} attributes populated
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasMissing ? (
            <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs font-medium rounded-full">
              {section.missingAttributes.length} missing
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-emerald-200 text-emerald-800 text-xs font-medium rounded-full">
              All populated
            </span>
          )}
          {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <div className="border rounded-lg overflow-hidden bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Attribute</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Current Value</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Status</th>
                      {hasMissing && (
                        <th className="text-left px-3 py-2 font-medium text-slate-600 text-xs">Resolution</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {section.attributes.map((attr, idx) => {
                      const isMissing = !attr.value || attr.value.trim() === '';
                      const missingInfo = section.missingAttributes.find(m => m.attributeName === attr.name);

                      return (
                        <tr
                          key={idx}
                          className={cn(
                            'border-b last:border-b-0 transition-colors',
                            isMissing ? 'bg-red-50/50' : 'hover:bg-slate-50'
                          )}
                        >
                          <td className="px-3 py-2">
                            <span className={cn(
                              'font-mono text-xs',
                              isMissing ? 'text-red-700 font-semibold' : 'text-slate-700'
                            )}>
                              {attr.name}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {isMissing ? (
                              <span className="text-red-400 italic text-xs">empty</span>
                            ) : (
                              <span className="text-slate-700 text-xs truncate max-w-[200px] block" title={attr.value}>
                                {attr.value.length > 40 ? attr.value.slice(0, 40) + '...' : attr.value}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isMissing ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-medium">
                                <XCircle size={10} /> Missing
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-medium">
                                <CheckCircle2 size={10} /> OK
                              </span>
                            )}
                          </td>
                          {hasMissing && (
                            <td className="px-3 py-2">
                              {missingInfo && (
                                <div>
                                  {missingInfo.resolvedValue ? (
                                    <div className="flex items-center gap-1">
                                      <ArrowRight size={10} className="text-blue-500 flex-shrink-0" />
                                      <div>
                                        <span className="text-xs text-blue-700 font-medium">
                                          {missingInfo.resolvedLabel || missingInfo.resolvedValue}
                                        </span>
                                        <div className="text-[10px] text-slate-400">{missingInfo.resolvedSource}</div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <span className="text-xs text-amber-600 italic">Not resolved</span>
                                      <div className="text-[10px] text-slate-400">Source: {missingInfo.resolvedSource}</div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function OECheckerModule() {
  const [serviceIdInput, setServiceIdInput] = useState('');
  const [activeServiceId, setActiveServiceId] = useState('');
  const [step, setStep] = useState<AnalysisStep>('idle');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showConfirmPatch, setShowConfirmPatch] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [patchSuccess, setPatchSuccess] = useState(false);

  const shouldFetch = !!activeServiceId && step !== 'idle';

  const {
    data: oeInfo,
    isLoading: isLoadingOE,
    error: oeError,
    refetch: refetchOE,
  } = useOEServiceInfo(activeServiceId, shouldFetch);

  const {
    data: serviceData,
    isLoading: isLoadingService,
  } = useService(activeServiceId, shouldFetch);

  const billingAccountId = serviceData?.x_billingAccountId || '';
  const { data: billingAccount, isLoading: isLoadingBA } = useBillingAccount(
    billingAccountId,
    shouldFetch && !!billingAccountId
  );

  const contactId = useMemo(() => {
    if (!billingAccount?.relatedParty) return '';
    const contact = billingAccount.relatedParty.find(
      rp => rp.role?.toLowerCase() === 'contact' || rp.partyOrPartyRole?.['@referredType'] === 'Individual'
    );
    return contact?.partyOrPartyRole?.id || '';
  }, [billingAccount]);

  const { data: individual, isLoading: isLoadingIndividual } = useIndividual(
    contactId,
    shouldFetch && !!contactId
  );

  const picEmail = useMemo(() => {
    if (serviceData?.x_picEmail) return serviceData.x_picEmail;
    if (!individual?.contactMedium) return undefined;
    const email = individual.contactMedium.find(cm => cm.contactType === 'email');
    return email?.emailAddress || undefined;
  }, [serviceData, individual]);

  const enrichmentData = useMemo(() => ({
    billingAccountId: serviceData?.x_billingAccountId,
    billingAccountName: billingAccount?.name || serviceData?.x_billingAccountName,
    externalId: serviceData?.x_externalId,
    picEmail,
  }), [serviceData, billingAccount, picEmail]);

  const isLoading = isLoadingOE || isLoadingService || isLoadingBA || isLoadingIndividual;

  const analysis = useMemo(() => {
    if (!oeInfo?.attachmentContent) return null;
    return analyzeAttachment(oeInfo.attachmentContent, enrichmentData, oeInfo.productDefinitionName);
  }, [oeInfo, enrichmentData]);

  const resolvableCount = useMemo(() => {
    if (!analysis) return 0;
    return analysis.missing.filter(m => m.resolvedValue).length;
  }, [analysis]);

  const handleCheck = useCallback(() => {
    const trimmed = serviceIdInput.trim();
    if (!trimmed) return;
    setActiveServiceId(trimmed);
    setStep('fetching');
    setShowConfirmPatch(false);
    setPatchError(null);
    setPatchSuccess(false);
    setExpandedSections(new Set());
  }, [serviceIdInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCheck();
  }, [handleCheck]);

  const patchMutation = useOEPatchAttachment();
  const remediateMutation = useOETriggerRemediation();

  const handlePatch = useCallback(async () => {
    if (!oeInfo?.attachmentContent || !analysis) return;

    setPatchError(null);
    setStep('patching');

    try {
      const content = JSON.parse(JSON.stringify(oeInfo.attachmentContent));

      if (Array.isArray(content.NonCommercialProduct)) {
        for (const item of content.NonCommercialProduct) {
          for (const [, productData] of Object.entries(item as Record<string, { attributes?: AttachmentAttribute[] }>)) {
            const attrs = productData.attributes || [];
            for (const attr of attrs) {
              const missing = analysis.missing.find(
                m => m.attributeName === attr.name && m.resolvedValue
              );
              if (missing && (!attr.value || attr.value.trim() === '')) {
                attr.value = missing.resolvedValue!;
                attr.label = missing.resolvedLabel || missing.resolvedValue!;
              }
            }
          }
        }
      }

      await patchMutation.mutateAsync({
        serviceId: activeServiceId,
        patchedContent: content,
      });

      await remediateMutation.mutateAsync({
        serviceId: activeServiceId,
        productDefinitionName: oeInfo.productDefinitionName,
      });

      setPatchSuccess(true);
      setStep('patched');
      setShowConfirmPatch(false);
    } catch (err) {
      setPatchError(err instanceof Error ? err.message : 'Patch failed');
      setStep('ready');
    }
  }, [oeInfo, analysis, activeServiceId, patchMutation, remediateMutation]);

  const currentStep = useMemo(() => {
    if (isLoadingOE) return 'fetching';
    if (oeError) return 'error';
    if (isLoadingService || isLoadingBA || isLoadingIndividual) return 'enriching';
    if (analysis) return step === 'patching' ? 'patching' : step === 'patched' ? 'patched' : 'ready';
    return step;
  }, [isLoadingOE, oeError, isLoadingService, isLoadingBA, isLoadingIndividual, analysis, step]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Search size={22} className="text-blue-600" />
            Migrated Service Data Checker
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Check a service for missing Order Enrichment data and preview the fix
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Database size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={serviceIdInput}
              onChange={e => setServiceIdInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter Service ID (e.g. a236D000000eq04QAA)"
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            />
          </div>
          <button
            onClick={handleCheck}
            disabled={!serviceIdInput.trim() || isLoading}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
              serviceIdInput.trim() && !isLoading
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Check Service
          </button>
        </div>
      </div>

      {/* Progress Steps */}
      {currentStep !== 'idle' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            {['fetching', 'enriching', 'ready'].map((s, idx) => {
              const stepLabels: Record<string, string> = {
                fetching: 'Fetch OE Data',
                enriching: 'Enrich from SF',
                ready: 'Analysis Ready',
              };
              const isActive = currentStep === s;
              const isPast = ['fetching', 'enriching', 'ready', 'patching', 'patched'].indexOf(currentStep) > idx;
              const isErr = currentStep === 'error' && idx === 0;

              return (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium flex-1 transition-colors',
                    isErr ? 'bg-red-100 text-red-700' :
                    isActive ? 'bg-blue-100 text-blue-700' :
                    isPast ? 'bg-emerald-100 text-emerald-700' :
                    'bg-slate-50 text-slate-400'
                  )}>
                    {isActive && !isErr && <Loader2 size={12} className="animate-spin" />}
                    {isPast && !isActive && <CheckCircle2 size={12} />}
                    {isErr && <XCircle size={12} />}
                    {stepLabels[s]}
                  </div>
                  {idx < 2 && <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error State */}
      {oeError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-xl p-5"
        >
          <div className="flex items-start gap-3">
            <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800 text-sm">Failed to fetch OE data</h3>
              <p className="text-xs text-red-600 mt-1">{oeError.message}</p>
              <button
                onClick={() => refetchOE()}
                className="mt-3 flex items-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-xs font-medium transition-colors"
              >
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Service Info Panel */}
      {oeInfo && !oeError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                <Eye size={18} className="text-slate-500" />
                Service: {oeInfo.serviceName || oeInfo.serviceId}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{oeInfo.serviceId}</p>
            </div>
            {analysis && (
              <StatusBadge status={analysis.missing.length === 0 ? 'ok' : analysis.missing.length > 3 ? 'error' : 'warning'} />
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <InfoTile label="Product Definition" value={oeInfo.productDefinitionName} />
            <InfoTile label="Attachment ID" value={oeInfo.attachmentId} mono />
            <InfoTile
              label="Replacement Service"
              value={oeInfo.replacementServiceExists ? 'Yes' : 'No'}
              color={oeInfo.replacementServiceExists ? 'amber' : 'emerald'}
            />
            <InfoTile label="API Status" value={oeInfo.success ? 'Success' : oeInfo.message || 'Failed'} color={oeInfo.success ? 'emerald' : 'red'} />
          </div>

          {serviceData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 pt-3 border-t border-slate-100">
              <InfoTile label="Account" value={serviceData.x_accountName || 'N/A'} />
              <InfoTile label="Billing Account" value={enrichmentData.billingAccountName || enrichmentData.billingAccountId || 'N/A'} />
              <InfoTile label="External ID" value={serviceData.x_externalId || 'N/A'} mono />
              <InfoTile label="PIC Email" value={picEmail || 'N/A'} />
            </div>
          )}
        </motion.div>
      )}

      {/* Analysis Results */}
      {analysis && !oeError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="Total Attributes"
              value={analysis.total}
              icon={<Database size={18} />}
              color="blue"
            />
            <SummaryCard
              label="Populated"
              value={analysis.populated}
              icon={<CheckCircle2 size={18} />}
              color="emerald"
            />
            <SummaryCard
              label="Missing"
              value={analysis.missing.length}
              icon={<FileWarning size={18} />}
              color={analysis.missing.length > 0 ? 'red' : 'emerald'}
            />
            <SummaryCard
              label="Auto-Resolvable"
              value={resolvableCount}
              icon={<ShieldCheck size={18} />}
              color={resolvableCount > 0 ? 'blue' : 'slate'}
            />
          </div>

          {/* Section-by-Section Analysis */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
              <FileWarning size={16} className="text-slate-500" />
              Attachment Analysis
            </h3>
            <div className="space-y-3">
              {analysis.sections.map((section, idx) => {
                const key = `${section.section}-${section.productName}`;
                return (
                  <SectionCard
                    key={idx}
                    section={section}
                    isExpanded={expandedSections.has(key)}
                    onToggle={() => toggleSection(key)}
                  />
                );
              })}
              {analysis.sections.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No attachment sections found
                </div>
              )}
            </div>
          </div>

          {/* Fix Preview & Action */}
          {analysis.missing.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 text-sm mb-4 flex items-center gap-2">
                <Wrench size={16} className="text-blue-600" />
                Fix Preview
              </h3>

              {analysis.missing.length > 0 && resolvableCount === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800">
                      <strong>{analysis.missing.length} missing attribute(s)</strong> found but none could be
                      resolved from available data sources. Manual intervention may be required.
                    </div>
                  </div>
                </div>
              )}

              {resolvableCount > 0 && (
                <>
                  <div className="border rounded-lg overflow-hidden mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-blue-50 border-b border-blue-100">
                          <th className="text-left px-3 py-2 font-medium text-blue-800 text-xs">Attribute</th>
                          <th className="text-left px-3 py-2 font-medium text-blue-800 text-xs">Product</th>
                          <th className="text-left px-3 py-2 font-medium text-blue-800 text-xs">New Value</th>
                          <th className="text-left px-3 py-2 font-medium text-blue-800 text-xs">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.missing.filter(m => m.resolvedValue).map((m, idx) => (
                          <tr key={idx} className="border-b last:border-b-0">
                            <td className="px-3 py-2 font-mono text-xs text-slate-800">{m.attributeName}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{m.productName}</td>
                            <td className="px-3 py-2 text-xs text-blue-700 font-medium">{m.resolvedLabel || m.resolvedValue}</td>
                            <td className="px-3 py-2 text-xs text-slate-500">{m.resolvedSource}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Patch actions */}
                  {!patchSuccess && !showConfirmPatch && (
                    <button
                      onClick={() => setShowConfirmPatch(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      <Wrench size={14} />
                      Apply Fix ({resolvableCount} attribute{resolvableCount !== 1 ? 's' : ''})
                    </button>
                  )}

                  {showConfirmPatch && !patchSuccess && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-2 mb-3">
                        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-800">
                          This will update the OE attachment in Salesforce and trigger a Solution Management sync.
                          Are you sure?
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handlePatch}
                          disabled={patchMutation.isPending || remediateMutation.isPending}
                          className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {(patchMutation.isPending || remediateMutation.isPending) && (
                            <Loader2 size={12} className="animate-spin" />
                          )}
                          Confirm & Patch
                        </button>
                        <button
                          onClick={() => setShowConfirmPatch(false)}
                          className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-md text-xs font-medium hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {patchError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-3">
                      <div className="flex items-start gap-2">
                        <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-red-700">
                          <strong>Patch failed:</strong> {patchError}
                        </div>
                      </div>
                    </div>
                  )}

                  {patchSuccess && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-emerald-50 border border-emerald-200 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-emerald-800">
                          <strong>Successfully patched!</strong> {resolvableCount} attribute(s) updated and
                          SM sync triggered. The service will be re-processed by Solution Management.
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          )}

          {/* No Issues */}
          {analysis.missing.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center"
            >
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
              <h3 className="font-semibold text-emerald-800 text-base">No Missing Data</h3>
              <p className="text-sm text-emerald-600 mt-1">
                All OE attributes for this service are populated. No remediation needed.
              </p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Idle State */}
      {currentStep === 'idle' && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <Search size={40} className="text-slate-300 mx-auto mb-3" />
          <h3 className="font-medium text-slate-600 text-base">Enter a Service ID to begin</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Paste a Salesforce Service ID to check its Order Enrichment attachment for missing data,
            see enrichment sources, and optionally apply fixes.
          </p>
        </div>
      )}
    </div>
  );
}

function InfoTile({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  const colorStyles: Record<string, string> = {
    emerald: 'text-emerald-700',
    red: 'text-red-700',
    amber: 'text-amber-700',
    blue: 'text-blue-700',
  };

  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2">
      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{label}</div>
      <div className={cn(
        'text-sm mt-0.5 truncate',
        mono && 'font-mono text-xs',
        color ? colorStyles[color] || 'text-slate-800' : 'text-slate-800'
      )} title={value}>
        {value}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', iconBg: 'bg-emerald-100' },
    red: { bg: 'bg-red-50', text: 'text-red-700', iconBg: 'bg-red-100' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-600', iconBg: 'bg-slate-100' },
  };
  const c = colorMap[color] || colorMap.slate;

  return (
    <div className={cn('rounded-xl p-4 border', c.bg)}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', c.iconBg, c.text)}>
          {icon}
        </div>
      </div>
      <div className={cn('text-2xl font-bold', c.text)}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
