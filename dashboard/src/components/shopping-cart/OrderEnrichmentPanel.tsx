'use client';

/**
 * Order Enrichment Panel - Per Solution
 * Displays OE data from CloudSense API Gateway for each solution/cart item
 */

import { useState } from 'react';
import { 
  Settings, ChevronDown, ChevronRight, AlertCircle, CheckCircle, 
  RefreshCw, Zap, FileText, Hash, User, Phone, CreditCard,
  Loader2, Info, Package
} from 'lucide-react';
import { useCloudSenseHealth } from '@/hooks/useCloudSense';
import { getConfigurations } from '@/lib/cloudsense-api';
import type { Configuration, OrderEnrichment, OEAttribute, ConfigurationsResponse } from '@/types/cloudsense';
// Cart item interface compatible with both direct API and TMF API
interface CartItemDetail {
  id: string;
  name?: string;
  solutionName?: string;
  productFamily?: string;
  product?: { id?: string; name?: string };
  parentConfigurationId?: string;
}

// Common OE attribute names to highlight
const IMPORTANT_ATTRIBUTES = [
  'Billing Account',
  'MSISDN',
  'ICCID',
  'SIM Serial Number',
  'Service ID',
  'Account Number',
  'Customer Name',
];

function getAttributeIcon(name: string) {
  if (name.toLowerCase().includes('billing') || name.toLowerCase().includes('account')) {
    return CreditCard;
  }
  if (name.toLowerCase().includes('msisdn') || name.toLowerCase().includes('phone')) {
    return Phone;
  }
  if (name.toLowerCase().includes('customer') || name.toLowerCase().includes('name')) {
    return User;
  }
  if (name.toLowerCase().includes('id') || name.toLowerCase().includes('serial')) {
    return Hash;
  }
  return FileText;
}

function AttributeRow({ attr }: { attr: OEAttribute }) {
  const Icon = getAttributeIcon(attr.name);
  const hasValue = attr.value !== '' && attr.value !== null && attr.value !== undefined;
  const isImportant = IMPORTANT_ATTRIBUTES.some(
    (imp) => attr.name.toLowerCase().includes(imp.toLowerCase())
  );
  
  return (
    <div className={`flex items-start gap-2 py-1.5 px-2 rounded ${
      isImportant ? 'bg-primary-50' : ''
    }`}>
      <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
        hasValue ? 'text-green-500' : 'text-neutral-300'
      }`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-500">{attr.name}</span>
          {attr.required && <span className="text-red-500 text-xs">*</span>}
          {attr.readonly && <span className="text-xs text-neutral-400">(readonly)</span>}
        </div>
        <div className={`text-sm font-medium truncate ${
          hasValue ? 'text-neutral-900' : 'text-neutral-400 italic'
        }`}>
          {attr.displayValue || String(attr.value) || '(empty)'}
        </div>
      </div>
    </div>
  );
}

function OECard({ oe }: { oe: OrderEnrichment }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Find important attributes
  const importantAttrs = oe.attributes.filter((attr) =>
    IMPORTANT_ATTRIBUTES.some((imp) => 
      attr.name.toLowerCase().includes(imp.toLowerCase())
    )
  );
  
  const missingRequired = oe.attributes.filter(
    (attr) => attr.required && (!attr.value || attr.value === '')
  );

  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      <div 
        className="p-3 cursor-pointer hover:bg-neutral-50 flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-orange-500" />
          <div>
            <span className="text-sm font-medium text-neutral-900">{oe.name}</span>
            <span className="text-xs text-neutral-500 ml-2">
              ({oe.attributeCount} attributes)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {missingRequired.length > 0 && (
            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
              {missingRequired.length} missing
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-neutral-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          )}
        </div>
      </div>
      
      {/* Important attributes preview (always visible) */}
      {!isExpanded && importantAttrs.length > 0 && (
        <div className="px-3 pb-3 border-t border-neutral-100">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mt-2">
            {importantAttrs.slice(0, 6).map((attr, idx) => (
              <div key={idx} className="text-xs">
                <span className="text-neutral-500">{attr.name}: </span>
                <span className={attr.value ? 'text-neutral-900' : 'text-red-500'}>
                  {attr.displayValue || String(attr.value) || 'Missing'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Expanded view */}
      {isExpanded && (
        <div className="border-t border-neutral-100">
          <div className="p-3 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {oe.attributes.map((attr, idx) => (
                <AttributeRow key={idx} attr={attr} />
              ))}
            </div>
          </div>
          
          {/* GUID for debugging */}
          <div className="px-3 py-2 bg-neutral-50 border-t border-neutral-100">
            <span className="text-xs text-neutral-400 font-mono">GUID: {oe.guid}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigurationCard({ config }: { config: Configuration }) {
  const [isExpanded, setIsExpanded] = useState(config.orderEnrichmentCount > 0);
  
  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      <div 
        className="p-3 cursor-pointer hover:bg-neutral-50 flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Zap className={`h-4 w-4 ${config.status ? 'text-green-600' : 'text-neutral-400'}`} />
          <div>
            <span className="text-sm font-medium text-neutral-900">{config.name}</span>
            <span className="text-xs text-neutral-500 ml-2 font-mono">{config.guid.slice(0, 8)}...</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {config.orderEnrichmentCount > 0 && (
            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
              {config.orderEnrichmentCount} OE
            </span>
          )}
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </div>
      
      {isExpanded && config.orderEnrichmentList.length > 0 && (
        <div className="p-3 pt-0 space-y-2 border-t border-neutral-100">
          {config.orderEnrichmentList.map((oe) => (
            <OECard key={oe.guid} oe={oe} />
          ))}
        </div>
      )}
    </div>
  );
}

// Per-solution OE card that loads data on demand
function SolutionOECard({ 
  item, 
  basketId 
}: { 
  item: CartItemDetail;
  basketId: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [oeData, setOeData] = useState<ConfigurationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Use the actual solution name from the Solution object, not the product config name
  const solutionName = item.solutionName || item.name || 'Unknown Solution';
  const displayName = item.name || item.solutionName || 'Unknown';
  
  const handleLoadOE = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getConfigurations(basketId, solutionName);
      setOeData(data);
      setIsExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OE data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-50">
            <Package className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h4 className="font-medium text-neutral-900">{displayName}</h4>
            {item.solutionName && item.solutionName !== item.name && (
              <p className="text-xs text-orange-600 mt-0.5">
                Solution: {item.solutionName}
              </p>
            )}
            <p className="text-xs text-neutral-500 font-mono">{item.id}</p>
            {item.productFamily && (
              <p className="text-xs text-neutral-500 mt-0.5">{item.productFamily}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {oeData && (
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
              {oeData.count} configs
            </span>
          )}
          <button
            onClick={handleLoadOE}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50 flex items-center gap-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </>
            ) : oeData ? (
              <>
                <RefreshCw className="h-3 w-3" />
                Refresh
              </>
            ) : (
              <>
                <Settings className="h-3 w-3" />
                Load OE
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Loading State */}
      {isLoading && (
        <div className="px-4 pb-4">
          <div className="p-4 bg-orange-50 rounded-lg text-center">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto mb-2" />
            <p className="text-xs text-orange-700">
              Loading OE data for solution "{solutionName}"...
            </p>
            <p className="text-xs text-orange-600 mt-1">
              This may take 30-60 seconds
            </p>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {error && !isLoading && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <div>
                <p className="text-xs text-red-700">{error}</p>
                <button
                  onClick={handleLoadOE}
                  className="text-xs text-red-800 underline mt-1"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* OE Data */}
      {oeData && !isLoading && (
        <div className="border-t border-neutral-100">
          <div 
            className="px-4 py-2 bg-neutral-50 cursor-pointer flex items-center justify-between"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs text-neutral-700">
                {oeData.count} configurations, {' '}
                {oeData.configurations.reduce((sum, c) => sum + c.orderEnrichmentCount, 0)} OE items
              </span>
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-neutral-400" />
            )}
          </div>
          
          {isExpanded && (
            <div className="p-4 space-y-2">
              {oeData.configurations.map((config) => (
                <ConfigurationCard key={config.guid} config={config} />
              ))}
              
              {oeData.configurations.length === 0 && (
                <p className="text-sm text-neutral-500 text-center py-2">
                  No configurations found for this solution
                </p>
              )}
              
              <p className="text-xs text-neutral-400 text-right mt-2">
                Fetched: {new Date(oeData.timestamp).toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface OrderEnrichmentPanelProps {
  basketId: string;
  cartItems?: CartItemDetail[];
  cartName?: string;
}

export function OrderEnrichmentPanel({ basketId, cartItems, cartName }: OrderEnrichmentPanelProps) {
  const health = useCloudSenseHealth();
  
  // Check if API is available
  const isApiHealthy = health.data?.status === 'healthy';
  const isApiChecking = health.isLoading;
  
  // Get unique solutions (root items without parent)
  const solutions = cartItems?.filter(item => !item.parentConfigurationId) || [];
  
  if (isApiChecking) {
    return (
      <div className="p-4 bg-neutral-50 rounded-lg">
        <div className="flex items-center gap-2 text-neutral-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Checking CloudSense API Gateway...</span>
        </div>
      </div>
    );
  }
  
  if (!isApiHealthy) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-yellow-900">CloudSense API Gateway Unavailable</h4>
            <p className="text-xs text-yellow-700 mt-1">
              The Order Enrichment data requires the CloudSense API Gateway to be running on port 8080.
            </p>
            <code className="text-xs bg-yellow-100 px-2 py-1 rounded mt-2 block">
              cd CloudSense_API_Gateway && python main.py
            </code>
            <button
              onClick={() => health.refetch()}
              className="mt-2 text-xs text-yellow-800 hover:text-yellow-900 flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-orange-500" />
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Order Enrichment by Solution</h3>
            <p className="text-xs text-neutral-500">
              Click "Load OE" on each solution to fetch its enrichment data
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-600">
          <CheckCircle className="h-4 w-4" />
          API Connected
        </div>
      </div>
      
      {/* Info */}
      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-orange-600 mt-0.5" />
          <div className="text-xs text-orange-700">
            <p><strong>Per-Solution Loading:</strong> Each solution's OE data is fetched independently.</p>
            <p className="mt-1">⚠️ Each request takes 30-60 seconds due to browser automation.</p>
          </div>
        </div>
      </div>
      
      {/* Solutions List */}
      {solutions.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs text-neutral-600">
            {solutions.length} solution{solutions.length !== 1 ? 's' : ''} found in this cart:
          </p>
          {solutions.map((item) => (
            <SolutionOECard 
              key={item.id} 
              item={item} 
              basketId={basketId}
            />
          ))}
        </div>
      ) : (
        <div className="p-6 bg-neutral-50 rounded-lg text-center">
          <Package className="h-8 w-8 text-neutral-400 mx-auto mb-2" />
          <p className="text-sm text-neutral-600">No solutions found in this cart</p>
          <p className="text-xs text-neutral-500 mt-1">
            Cart items need to be loaded first
          </p>
        </div>
      )}
      
      {/* Basket ID for reference */}
      <div className="text-xs text-neutral-400 border-t border-neutral-100 pt-3">
        Basket ID: <span className="font-mono">{basketId}</span>
      </div>
    </div>
  );
}

