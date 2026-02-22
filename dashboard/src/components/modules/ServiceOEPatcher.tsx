'use client';

import { useState } from 'react';
import { Spinner } from '@/components/ui/loader';
import { cn } from '@/lib/utils';
import { usePatchPreview, usePatchOEService } from '@/hooks/useCloudSense';
import { usePicEmailLookup } from '@/tmf/working-apis/hooks';
import type { Service } from '@/tmf/working-apis/api';

/**
 * Service OE Patcher Component
 * 
 * Displays:
 * 1. Current service info
 * 2. Missing OE fields
 * 3. Fields that WILL be patched (with correct values from Salesforce)
 * 4. "Patch OE" button to auto-fix
 * 
 * Similar to Solution Empty fix, but for 1867 OE issues.
 */

interface ServiceOEPatcherProps {
  service: Service;
}

export function ServiceOEPatcher({ service }: ServiceOEPatcherProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  // PIC Email lookup via TMF APIs: Service → BillingAccount → Individual → Email
  const picEmailLookup = usePicEmailLookup(service);
  
  // Fetch patch preview (what will be patched)
  const { data: preview, isLoading, error } = usePatchPreview(
    showDetails ? service.id : undefined
  );
  
  // Patch mutation
  const patchMutation = usePatchOEService();
  
  const handlePatch = async () => {
    if (!confirm(`Patch OE data for service: ${service.name}?`)) {
      return;
    }
    
    try {
      // Build fields to patch from preview data
      const fieldsToPatch: Array<{fieldName: string; value: string; label?: string}> = [];
      
      // Get missing fields from preview if available
      if (preview?.analysis?.missingFields) {
        // Add BillingAccount if missing and available
        if (preview.analysis.missingFields.includes('BillingAccount') && service.x_billingAccountId) {
          fieldsToPatch.push({
            fieldName: 'BillingAccount',
            value: service.x_billingAccountId,
            label: service.x_billingAccountName || service.x_billingAccountId
          });
        }
        
        // Add PICEmail if missing and available from lookup
        if (preview.analysis.missingFields.includes('PICEmail') && picEmailLookup.picEmail) {
          fieldsToPatch.push({
            fieldName: 'PICEmail',
            value: picEmailLookup.picEmail,
            label: picEmailLookup.picEmail
          });
        }
        
        // Add ReservedNumber if missing and available
        if (preview.analysis.missingFields.includes('ReservedNumber') && service.x_externalId) {
          fieldsToPatch.push({
            fieldName: 'ReservedNumber',
            value: service.x_externalId,
            label: service.x_externalId
          });
        }
      }
      
      if (fieldsToPatch.length === 0) {
        alert('No fields to patch. Either all fields are present or required data is not available.');
        return;
      }
      
      await patchMutation.mutateAsync({ 
        serviceId: service.id,
        serviceType: service.x_serviceType || 'Unknown',
        fieldsToPatch,
        dryRun: false
      });
    } catch (e) {
      console.error('Patch failed:', e);
    }
  };
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {service.x_has1867Issue ? '⚠️' : '✅'}
            </span>
            <h3 className="font-semibold text-gray-900 truncate">{service.name}</h3>
          </div>
          <p className="text-xs text-gray-500 font-mono mt-1">{service.id}</p>
          <div className="flex gap-2 mt-1">
            {service.x_serviceType && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                {service.x_serviceType}
              </span>
            )}
            {service.x_migratedData && (
              <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded text-xs">
                Migrated
              </span>
            )}
          </div>
          
          {/* PIC Email via TMF API chain lookup */}
          <div className="mt-2 text-xs">
            {picEmailLookup.isLoading ? (
              <span className="text-gray-400 flex items-center gap-1">
                <Spinner size="sm" /> Loading PIC Email...
              </span>
            ) : picEmailLookup.picEmail ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">📧 PIC Email:</span>
                <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {picEmailLookup.picEmail}
                </span>
              </div>
            ) : picEmailLookup.billingAccountId ? (
              <div className="flex items-center gap-2">
                <span className="text-amber-600">⚠️ PIC Email not found</span>
                <span className="text-gray-400">(Contact missing on Billing Account)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-red-600">❌ No Billing Account</span>
              </div>
            )}
            {picEmailLookup.billingAccountName && (
              <div className="text-gray-500 mt-0.5">
                Billing Account: {picEmailLookup.billingAccountName}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Expand/Collapse Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full text-left flex items-center justify-between text-sm text-blue-600 hover:text-blue-700 py-2 border-t border-gray-100"
      >
        <span className="font-medium">🔧 Inspect & Patch OE</span>
        <span>{showDetails ? '▼' : '▶'}</span>
      </button>
      
      {/* Details Panel */}
      {showDetails && (
        <div className="mt-3 space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
              <Spinner size="sm" />
              <span className="text-sm text-gray-600">Analyzing OE data...</span>
            </div>
          ) : error ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">Error: {error.message}</p>
            </div>
          ) : preview ? (
            <>
              {/* Service Details */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg text-xs">
                <div>
                  <span className="text-gray-600">Service Type:</span>
                  <span className="ml-2 font-semibold">{preview.serviceType}</span>
                </div>
                <div>
                  <span className="text-gray-600">Solution ID:</span>
                  <span className="ml-2 font-mono">{preview.solutionId?.substring(0, 15)}...</span>
                </div>
              </div>
              
              {/* Missing Fields */}
              {preview.originalMissingFields?.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-700 mb-2">
                    Missing Mandatory Fields ({preview.originalMissingFields.length})
                  </p>
                  <div className="space-y-1">
                    {preview.originalMissingFields.map((field: string) => (
                      <div key={field} className="text-xs text-red-600 flex items-center gap-1">
                        <span>❌</span>
                        <span className="font-mono">{field}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Patchable Fields (THE KEY FEATURE!) */}
              {preview.patchableFields?.length > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-sm font-medium text-emerald-700 mb-2">
                    ✅ Auto-Patchable Fields ({preview.patchableFields.length})
                  </p>
                  <div className="space-y-2">
                    {preview.patchableFields.map((field: any) => (
                      <div key={field.fieldName} className="text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-emerald-700">
                            {field.fieldName}
                          </span>
                          <span className="text-gray-500 text-[10px]">
                            from {field.source}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-white rounded">
                          <span className="text-gray-600">Will patch:</span>
                          <span className="font-mono text-gray-900 break-all">
                            {field.newValue}
                          </span>
                        </div>
                        {field.description && (
                          <p className="text-gray-500 italic">{field.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Not Patchable Fields */}
              {preview.notPatchableFields?.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-medium text-amber-700 mb-2">
                    ⚠️ Cannot Auto-Patch ({preview.notPatchableFields.length})
                  </p>
                  <div className="space-y-1">
                    {preview.notPatchableFields.map((field: string) => (
                      <div key={field} className="text-xs text-amber-600 flex items-center gap-1">
                        <span>⚠️</span>
                        <span className="font-mono">{field}</span>
                        <span className="text-gray-500">(no Salesforce source)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Warnings */}
              {preview.warnings?.length > 0 && (
                <div className="p-2 bg-amber-50 rounded text-xs text-amber-700 space-y-1">
                  {preview.warnings.map((warning: string, i: number) => (
                    <div key={i}>⚠️ {warning}</div>
                  ))}
                </div>
              )}
              
              {/* Patch Button */}
              {preview.canPatch && !patchMutation.isSuccess && (
                <button
                  onClick={handlePatch}
                  disabled={patchMutation.isPending}
                  className={cn(
                    "w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors",
                    patchMutation.isPending
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  )}
                >
                  {patchMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner size="sm" className="border-white border-t-transparent" />
                      Patching OE...
                    </span>
                  ) : (
                    `🔧 Patch ${preview.patchableFields.length} Field${preview.patchableFields.length > 1 ? 's' : ''}`
                  )}
                </button>
              )}
              
              {/* Success Message */}
              {patchMutation.isSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-sm font-medium text-emerald-700">
                    ✅ OE Patched Successfully!
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {patchMutation.data?.patchedFields?.length || 0} field(s) updated
                  </p>
                  {patchMutation.data?.remainingMissingFields?.length > 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠️ {patchMutation.data.remainingMissingFields.length} field(s) still need manual handling
                    </p>
                  )}
                </div>
              )}
              
              {/* Error Message */}
              {patchMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-700">❌ Patch Failed</p>
                  <p className="text-xs text-red-600 mt-1">
                    {patchMutation.error?.message || 'Unknown error'}
                  </p>
                </div>
              )}
              
              {/* No Patchable Fields */}
              {!preview.canPatch && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-700">
                    ℹ️ No fields can be auto-patched. Salesforce source data is missing.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
