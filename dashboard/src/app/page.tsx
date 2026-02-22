'use client';

import { useState } from 'react';
import { 
  useServiceList, 
  useProductOrderList, 
  useShoppingCartList,
  useProductList,
  useBillingAccountList,
  useProduct
} from '@/tmf/working-apis/hooks';
import { Spinner, CardLoader } from '@/components/ui/loader';
import { cn } from '@/lib/utils';
import type { 
  Service, 
  ProductOrder, 
  ShoppingCart, 
  Product,
  BillingAccount 
} from '@/tmf/working-apis/api';
import { OEPatcherModule, BasketOEAnalysis } from '@/components/modules/OEPatcherModule';
import ServiceProblemModule from '@/components/modules/ServiceProblemModule';
import { BatchScheduler } from '@/components/modules/BatchScheduler';
import { useFixSolution } from '@/hooks/useCloudSense';

type ModuleType = 'oe-patcher' | 'solution-empty' | 'order-not-gen' | 'iot-qbs' | 'remediation-history';

// Module definitions based on CloudSense_Objects_By_Module.md
const modules = [
  { 
    id: 'oe-patcher' as ModuleType, 
    name: '1867 OE Data Patcher',
    description: 'Patch missing OE attributes on MACD baskets',
    icon: '🔧',
    color: 'blue',
    tmfApis: ['TMF638 Service', 'TMF666 BillingAccount'],
    cloudSenseObjects: ['csord__Service__c', 'csconta__Billing_Account__c', 'Contact']
  },
  { 
    id: 'solution-empty' as ModuleType, 
    name: '1147 Solution Empty',
    description: 'Re-migrate solutions with empty configurations',
    icon: '📦',
    color: 'violet',
    tmfApis: ['TMF637 Product'],
    cloudSenseObjects: ['csord__Solution__c', 'cscfga__Product_Configuration__c']
  },
  { 
    id: 'order-not-gen' as ModuleType, 
    name: 'Order Not Generated',
    description: 'Orders not generated due to high async count',
    icon: '⚠️',
    color: 'amber',
    tmfApis: ['TMF663 ShoppingCart', 'TMF622 ProductOrder'],
    cloudSenseObjects: ['cscfga__Product_Basket__c', 'AsyncApexJob']
  },
  { 
    id: 'iot-qbs' as ModuleType, 
    name: 'IoT QBS Remediator',
    description: 'Repair corrupted PC linkages in IoT solutions',
    icon: '🔌',
    color: 'emerald',
    tmfApis: ['TMF638 Service', 'TMF622 ProductOrder', 'TMF653 TaskFlow'],
    cloudSenseObjects: ['CSPOFA__Orchestration_Process__c', 'CSPOFA__Orchestration_Step__c', 'csord__Service__c']
  },
  { 
    id: 'remediation-history' as ModuleType, 
    name: 'Service Problems (TMF656)',
    description: 'Track confirmed issues and remediation progress',
    icon: '📋',
    color: 'slate',
    tmfApis: ['TMF656 ServiceProblem'],
    cloudSenseObjects: ['tmf.serviceProblem']
  },
];

// Order Card Component
function OrderCard({ order }: { order: ProductOrder }) {
  const stateColors: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    inProgress: 'bg-blue-100 text-blue-700',
    acknowledged: 'bg-violet-100 text-violet-700',
    pending: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
  };

  const orderNumber = order.externalId?.[0]?.id || order.id;
  const customerName = order.relatedParty?.[0]?.partyOrPartyRole?.name;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{orderNumber}</h3>
          {customerName && (
            <p className="text-sm text-gray-600 truncate">{customerName}</p>
          )}
        </div>
        {order.state && (
          <span className={cn(
            'px-2 py-1 rounded-full text-xs font-medium ml-2 whitespace-nowrap',
            stateColors[order.state] || 'bg-gray-100 text-gray-600'
          )}>
            {order.state}
          </span>
        )}
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <p>Category: {order.category || 'N/A'}</p>
        {order.creationDate && (
          <p>Created: {new Date(order.creationDate).toLocaleDateString()}</p>
        )}
        {order.completionDate && (
          <p className="text-emerald-600">Completed: {new Date(order.completionDate).toLocaleDateString()}</p>
        )}
      </div>
    </div>
  );
}

// Shopping Cart Card Component
function CartCard({ cart }: { cart: ShoppingCart }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{cart.name || cart.id}</h3>
          <p className="text-xs text-gray-500 font-mono truncate">{cart.id}</p>
        </div>
        {cart.status && (
          <span className={cn(
            'px-2 py-1 rounded-full text-xs font-medium ml-2',
            cart.status === 'Order Generation' ? 'bg-amber-100 text-amber-700' :
            cart.status === 'Order Submitted' ? 'bg-emerald-100 text-emerald-700' :
            'bg-gray-100 text-gray-600'
          )}>
            {cart.status}
          </span>
        )}
      </div>
      {cart.creationDate && (
        <p className="text-xs text-gray-500">
          Created: {new Date(cart.creationDate).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

// Service Card Component
function ServiceCard({ service }: { service: Service }) {
  const [showSolution, setShowSolution] = useState(false);
  const stateColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-gray-100 text-gray-600',
    pending: 'bg-amber-100 text-amber-700',
  };

  // Extract solution ID from relatedEntity
  const supportingProduct = service.relatedEntity?.find(
    e => e.role === 'supportingProduct' && e.entity?.['@referredType'] === 'Product'
  );
  const solutionId = supportingProduct?.entity?.id;
  
  // Fetch solution details when expanded (only if solution exists)
  const { data: solution, isLoading: solutionLoading } = useProduct(
    showSolution && solutionId ? solutionId : undefined
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{service.name}</h3>
          <p className="text-xs text-gray-500 mt-1 font-mono truncate">{service.id}</p>
        </div>
        {service.state && (
          <span className={cn(
            'px-2 py-1 rounded-full text-xs font-medium ml-2',
            stateColors[service.state.toLowerCase()] || 'bg-gray-100 text-gray-600'
          )}>
            {service.state}
          </span>
        )}
      </div>
      {service.startDate && (
        <p className="text-xs text-gray-500">
          Started: {new Date(service.startDate).toLocaleDateString()}
        </p>
      )}
      
      {/* Solution/Product Link */}
      {solutionId && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => setShowSolution(!showSolution)}
            className="w-full text-left flex items-center justify-between text-xs text-blue-600 hover:text-blue-700"
          >
            <span className="font-medium">📦 Solution/Product</span>
            <span>{showSolution ? '▼' : '▶'}</span>
          </button>
          
          {showSolution && (
            <div className="mt-2 bg-blue-50 rounded-lg p-2 space-y-1">
              {solutionLoading ? (
                <div className="flex items-center gap-2">
                  <Spinner size="sm" />
                  <span className="text-xs text-gray-600">Loading solution...</span>
                </div>
              ) : solution ? (
                <>
                  <div className="text-xs">
                    <span className="text-gray-600">Name:</span>{' '}
                    <span className="font-semibold text-gray-900">{solution.name}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-600">ID:</span>{' '}
                    <span className="font-mono text-gray-700">{solution.id}</span>
                  </div>
                  {solution.status && (
                    <div className="text-xs">
                      <span className="text-gray-600">Status:</span>{' '}
                      <span className={cn(
                        'font-medium',
                        solution.status === 'active' ? 'text-emerald-600' : 'text-gray-700'
                      )}>{solution.status}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-red-600">Failed to load solution</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Product Card Component
function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{product.name || product.id}</h3>
          <p className="text-xs text-gray-500 mt-1 font-mono truncate">{product.id}</p>
        </div>
        {product.status && (
          <span className={cn(
            'px-2 py-1 rounded-full text-xs font-medium ml-2',
            product.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
          )}>
            {product.status}
          </span>
        )}
      </div>
      {product.productSpecification?.name && (
        <p className="text-xs text-gray-500">Spec: {product.productSpecification.name}</p>
      )}
    </div>
  );
}

// Solution Card Component (for bundles with migration info)
// Enhanced with full TMF637 Product mapping from csord__Solution__c
function SolutionCard({ solution, isFailedMigration }: { solution: Product; isFailedMigration?: boolean }) {
  const [showOEData, setShowOEData] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const fixSolution = useFixSolution();
  
  // Extract characteristics
  const getCharacteristic = (name: string) => {
    const char = solution.productCharacteristic?.find(c => c.name === name);
    return char?.value;
  };
  
  const solutionStatus = getCharacteristic('solutionStatus') || 'N/A';
  const remediationStatus = getCharacteristic('remediationStatus') || 'not_processed';
  const isMigratedToHeroku = getCharacteristic('isMigratedToHeroku');
  
  // Extract relatedParty info
  const customerParty = solution.relatedParty?.find(p => p.role === 'customer');
  const creatorParty = solution.relatedParty?.find(p => p.role === 'creator');
  const customerName = customerParty?.partyOrPartyRole?.name || 'N/A';
  const creatorName = creatorParty?.partyOrPartyRole?.name || 'N/A';
  
  // Extract productRelationship (MACD)
  const productRelationship = solution.productRelationship?.[0];
  const macdType = productRelationship?.relationshipType;
  const macdTargetId = productRelationship?.id;
  
  // Child products count
  const childProductCount = solution.product?.length || 0;

  return (
    <div className={cn(
      "rounded-xl border p-4 hover:shadow-lg transition-all",
      isFailedMigration 
        ? "bg-red-50 border-red-200" 
        : "bg-white border-gray-200"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{isFailedMigration ? '🚨' : '📦'}</span>
            <h3 className="font-semibold text-gray-900 truncate">{solution.name || solution.id}</h3>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-500 font-mono truncate">{solution.id}</p>
            {solution.productSerialNumber && (
              <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-xs font-medium">
                {solution.productSerialNumber}
              </span>
            )}
          </div>
        </div>
        {/* Migration Status Badge (from csord__External_Identifier__c) */}
        {solution.status && (
          <span className={cn(
            'px-2 py-1 rounded-full text-xs font-medium ml-2 whitespace-nowrap',
            solution.status === 'Not Migrated Successfully' ? 'bg-red-100 text-red-700' :
            solution.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
            solution.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          )}>
            {solution.status}
          </span>
        )}
      </div>
      
      {/* Key Info Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-gray-500">Migration Status</div>
          <div className={cn(
            "font-semibold",
            solution.status === 'Not Migrated Successfully' ? 'text-red-600' :
            solution.status === 'Completed' ? 'text-emerald-600' : 'text-gray-900'
          )}>{solution.status || 'N/A'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-gray-500">Solution Status</div>
          <div className={cn(
            "font-semibold",
            solutionStatus === 'Completed' ? 'text-emerald-600' :
            solutionStatus === 'Active' ? 'text-blue-600' :
            solutionStatus === 'Unknown' ? 'text-amber-600' : 'text-gray-900'
          )}>{solutionStatus}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-gray-500">Migrated to Heroku</div>
          <div className={cn(
            "font-semibold",
            isMigratedToHeroku === 'true' ? 'text-emerald-600' : 'text-red-600'
          )}>{isMigratedToHeroku === 'true' ? '✅ Yes' : '❌ No'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-gray-500">Remediation</div>
          <div className={cn(
            "font-semibold",
            remediationStatus === 'resolved' ? 'text-emerald-600' :
            remediationStatus === 'acknowledged' ? 'text-blue-600' :
            remediationStatus === 'not_processed' ? 'text-gray-500' : 'text-amber-600'
          )}>{remediationStatus}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-gray-500">Child Products</div>
          <div className="font-semibold text-violet-600">{childProductCount} subscription(s)</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-gray-500">Is Bundle</div>
          <div className="font-semibold text-gray-900">{solution.isBundle ? '✅ Yes' : 'No'}</div>
        </div>
      </div>
      
      {/* Product Pricing Section */}
      {solution.productPrice && solution.productPrice.length > 0 && (
        <div className="mb-3 p-3 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg border border-emerald-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">💰</span>
            <span className="text-xs font-semibold text-gray-700">Contract Value</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {solution.productPrice.map((pp, idx) => {
              const amount = pp.price?.taxIncludedAmount?.value || 0;
              const currency = pp.price?.taxIncludedAmount?.unit || 'MYR';
              const label = pp.name || pp.priceType || 'Price';
              return (
                <div key={idx} className="bg-white/70 rounded-lg p-2">
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="font-bold text-gray-900">
                    {currency} {amount.toLocaleString()}
                  </div>
                  {pp.recurringChargePeriod && (
                    <div className="text-xs text-gray-400">/{pp.recurringChargePeriod}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Expandable Details Section */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full text-xs text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 py-1 mb-2"
      >
        {showDetails ? '▲ Hide Details' : '▼ Show More Details'}
      </button>
      
      {showDetails && (
        <div className="space-y-2 text-xs border-t border-gray-100 pt-3 mb-3">
          {/* Customer & Creator */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">🏢 Customer:</span>
              <div className="font-medium text-gray-700 truncate">{customerName}</div>
            </div>
            <div>
              <span className="text-gray-500">👤 Creator:</span>
              <div className="font-medium text-gray-700 truncate">{creatorName}</div>
            </div>
          </div>
          
          {/* Billing Account */}
          {solution.billingAccount && (
            <div>
              <span className="text-gray-500">💳 Billing Account:</span>
              <div className="font-medium text-gray-700">
                {solution.billingAccount.name || solution.billingAccount.id}
              </div>
            </div>
          )}
          
          {/* MACD Relationship */}
          {macdType && (
            <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
              <span className="text-amber-700 font-medium">🔄 MACD: {macdType}</span>
              <div className="font-mono text-gray-600 truncate">{macdTargetId}</div>
            </div>
          )}
          
          {/* Product Term */}
          {solution.productTerm && solution.productTerm.length > 0 && (
            <div>
              <span className="text-gray-500">📅 Contract Term:</span>
              <span className="font-medium text-gray-700 ml-1">
                {solution.productTerm[0].duration?.amount} {solution.productTerm[0].duration?.units}
              </span>
            </div>
          )}
          
          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            {solution.creationDate && (
              <div>
                <span className="text-gray-500">Created:</span>
                <div className="text-gray-700">{new Date(solution.creationDate).toLocaleDateString()}</div>
              </div>
            )}
            {solution.startDate && (
              <div>
                <span className="text-gray-500">Start Date:</span>
                <div className="text-gray-700">{new Date(solution.startDate).toLocaleDateString()}</div>
              </div>
            )}
            {solution.terminationDate && (
              <div>
                <span className="text-gray-500">End Date:</span>
                <div className="text-gray-700">{new Date(solution.terminationDate).toLocaleDateString()}</div>
              </div>
            )}
          </div>
          
          {/* Child Products List */}
          {solution.product && solution.product.length > 0 && (
            <div className="bg-violet-50 rounded-lg p-2 border border-violet-100">
              <div className="text-violet-700 font-medium mb-1">📦 Child Subscriptions ({childProductCount})</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {solution.product.map((prod, idx) => {
                  const prodRef = (prod as { productRef?: { id: string; name?: string; href?: string } }).productRef;
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="text-violet-500">•</span>
                      <span className="font-medium text-gray-700">{prodRef?.name || 'Subscription'}</span>
                      <span className="text-gray-400 font-mono truncate">{prodRef?.id}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowOEData(!showOEData)}
          className={cn(
            "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
            showOEData 
              ? "bg-gray-200 text-gray-700 hover:bg-gray-300" 
              : "bg-blue-600 text-white hover:bg-blue-700"
          )}
        >
          {showOEData ? 'Hide OE Data' : 'See OE Data'}
        </button>
        
        {isFailedMigration && (
          <button
            onClick={() => {
              if (confirm(`Are you sure you want to fix solution ${solution.name || solution.id}? This will trigger Heroku migration scripts.`)) {
                fixSolution.mutate({ solutionId: solution.id, solutionName: solution.name });
              }
            }}
            disabled={fixSolution.isPending}
            className={cn(
              "flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
              fixSolution.isPending
                ? "bg-gray-400 text-white cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            )}
          >
            {fixSolution.isPending ? (
              <>
                <Spinner size="sm" className="border-white border-t-transparent" />
                Fixing...
              </>
            ) : (
              <>
                🔧 Fix
              </>
            )}
          </button>
        )}
      </div>
      
      {/* Fix Status Messages */}
      {fixSolution.isSuccess && (
        <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
          ✅ Fix operation initiated. Migration will be re-triggered.
        </div>
      )}
      
      {fixSolution.isError && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          ❌ Error: {fixSolution.error?.message || 'Failed to fix solution'}
        </div>
      )}
      
      {/* OE Data Panel */}
      {showOEData && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <BasketOEAnalysis 
            basketId={solution.id} 
            solutionName={solution.name || 'Unknown Solution'} 
          />
        </div>
      )}
    </div>
  );
}

// Billing Account Card Component
function BillingAccountCard({ account }: { account: BillingAccount }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
          BA
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{account.name || 'Billing Account'}</h3>
          <p className="text-xs text-gray-500 font-mono truncate">{account.id}</p>
        </div>
      </div>
    </div>
  );
}

// Module Panel Component
function ModulePanel({ moduleId }: { moduleId: ModuleType }) {
  const module = modules.find(m => m.id === moduleId);
  
  // ========================================
  // OPTIMIZED API CALLS - Reduced redundancy
  // ========================================
  
  // ShoppingCart: Only stuck baskets (Order Generation stage)
  const stuckCarts = useShoppingCartList({ 
    limit: 20, 
    status: 'Order Generation' 
  });
  
  // ProductOrder: Only in-progress orders
  const pendingOrders = useProductOrderList({ 
    limit: 20, 
    state: 'inProgress' 
  });
  
  // Services: Active services for OE data
  const activeServices = useServiceList({ limit: 20 });
  
  // Products: Failed migration solutions (main query for 1147 module)
  // Note: No isBundle filter - migrated solutions have isBundleSolution__c=false
  const failedMigrationSolutions = useProductList({ 
    limit: 50, 
    status: 'Not Migrated Successfully',
    relatedPartyName: 'Migration User'
  });
  
  // Products: All products (no status filter, limit 50)
  const allProducts = useProductList({ 
    limit: 50
  });
  
  // Billing accounts
  const billingAccounts = useBillingAccountList({ limit: 20 });

  // Safely extract arrays from API responses - handle various response shapes
  const extractArray = <T,>(data: unknown): T[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object' && 'data' in (data as object)) {
      const inner = (data as { data: unknown }).data;
      if (Array.isArray(inner)) return inner;
    }
    return [];
  };

  const stuckCartData = extractArray<ShoppingCart>(stuckCarts.data?.data ?? stuckCarts.data);
  const pendingOrderData = extractArray<ProductOrder>(pendingOrders.data?.data ?? pendingOrders.data);
  const serviceData = extractArray<Service>(activeServices.data?.data ?? activeServices.data);
  const failedMigrationData = extractArray<Product>(failedMigrationSolutions.data?.data ?? failedMigrationSolutions.data);
  const allProductData = extractArray<Product>(allProducts.data?.data ?? allProducts.data);
  const billingData = extractArray<BillingAccount>(billingAccounts.data?.data ?? billingAccounts.data);

  if (!module) return null;

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="text-4xl">{module.icon}</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{module.name}</h2>
            <p className="text-gray-600 mt-1">{module.description}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {module.tmfApis.map(api => (
                <span key={api} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                  {api}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {module.cloudSenseObjects.map(obj => (
                <span key={obj} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                  {obj}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Module Content based on type */}
      {/* order-monitor module removed (duplicate with Order Not Generated). */}

      {moduleId === 'oe-patcher' && (
        <OEPatcherModule />
      )}

      {moduleId === 'solution-empty' && (
        <>
          {/* Detection Alert */}
          <div className={cn(
            "rounded-xl p-4 border",
            failedMigrationData.length > 0 
              ? "bg-red-50 border-red-200" 
              : "bg-emerald-50 border-emerald-200"
          )}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{failedMigrationData.length > 0 ? '🚨' : '✅'}</span>
              <div>
                <h4 className="font-semibold text-gray-900">Detection Result</h4>
                <p className={failedMigrationData.length > 0 ? "text-red-700" : "text-emerald-700"}>
                  {failedMigrationData.length > 0 
                    ? `${failedMigrationData.length} solution(s) with "Not Migrated Successfully" status - need re-migration`
                    : "No solutions with failed migrations detected"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Query: <code className="bg-white/50 px-1 rounded">status='Not Migrated Successfully'</code> + <code className="bg-white/50 px-1 rounded">relatedParty.name='Migration User'</code>
                </p>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-3xl font-bold text-violet-600">{allProductData.length}</div>
              <div className="text-sm text-gray-500">Total Products</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-3xl font-bold text-red-600">{failedMigrationData.length}</div>
              <div className="text-sm text-gray-500">Failed Migrations</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-3xl font-bold text-emerald-600">
                {allProductData.filter(s => s.status === 'Completed').length}
              </div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-3xl font-bold text-amber-600">
                {allProductData.filter(s => s.status && s.status !== 'Completed').length}
              </div>
              <div className="text-sm text-gray-500">In Progress</div>
            </div>
          </div>

          {/* Failed Migration Solutions - Priority display */}
          {failedMigrationData.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-red-800">🚨 Failed Migration Solutions (Action Required)</h3>
                  <p className="text-sm text-red-600">
                    Filtered by: <code className="bg-red-100 px-1 rounded">status=Not Migrated Successfully</code> + 
                    <code className="bg-red-100 px-1 rounded ml-1">relatedParty.partyOrPartyRole.name=Migration User</code>
                  </p>
                </div>
                <button
                  onClick={() => failedMigrationSolutions.refetch()}
                  disabled={failedMigrationSolutions.isFetching}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                >
                  {failedMigrationSolutions.isFetching && <Spinner size="sm" className="border-white border-t-transparent" />}
                  Refresh
                </button>
              </div>
              {failedMigrationSolutions.isLoading && <CardLoader message="Loading failed migration solutions..." />}
              {failedMigrationSolutions.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                  Error: {failedMigrationSolutions.error.message}
                </div>
              )}
              {!failedMigrationSolutions.isLoading && !failedMigrationSolutions.error && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {failedMigrationData.map((solution) => (
                    <SolutionCard key={solution.id} solution={solution} isFailedMigration={true} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Batch Scheduling - TMF697 WorkOrder */}
          <BatchScheduler 
            category="SolutionEmpty" 
            useCase="1147"
            onImmediateStart={({ batchSize }) => {
              console.log(`Starting immediate batch with size: ${batchSize}`);
            }}
          />

          {/* Service Problems - 1147 Module (SolutionEmpty Issues) */}
          <ServiceProblemModule filterCategory="SolutionEmpty" />

          {/* Remediation Info */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
            <h4 className="font-semibold text-violet-800 flex items-center gap-2">
              🔧 Remediation Steps (from Maxis SOP)
            </h4>
            <div className="text-violet-700 mt-2 text-sm space-y-3">
              <div>
                <p className="font-medium">Step 1: Identify affected solutions</p>
                <code className="block bg-violet-100 p-2 rounded mt-1 text-xs">
                  SELECT Id, Name FROM csord__Solution__c<br/>
                  WHERE CreatedBy.Name = 'Migration User'<br/>
                  AND csord__External_Identifier__c = 'Not Migrated Successfully'
                </code>
              </div>
              <div>
                <p className="font-medium">Step 2: Run Heroku migration scripts</p>
                <ul className="list-disc list-inside mt-1 text-xs">
                  <li>Delete existing corrupted data</li>
                  <li>Update solution configuration</li>
                  <li>Re-trigger Heroku migration</li>
                </ul>
              </div>
              <div>
                <p className="font-medium">Step 3: Verify migration success</p>
                <code className="block bg-violet-100 p-2 rounded mt-1 text-xs">
                  Is_Migrated_to_Heroku__c = true<br/>
                  Is_Configuration_Updated_To_Heroku__c = true
                </code>
              </div>
            </div>
          </div>

          {/* All Products - Moved to bottom */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">All Products</h3>
                <p className="text-sm text-gray-500">TMF637 Product (csord__Solution__c)</p>
              </div>
              <button
                onClick={() => allProducts.refetch()}
                disabled={allProducts.isFetching}
                className="px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {allProducts.isFetching && <Spinner size="sm" className="border-white border-t-transparent" />}
                Refresh
              </button>
            </div>
            {allProducts.isLoading && <CardLoader message="Loading products..." />}
            {allProducts.error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">Error: {allProducts.error.message}</div>}
            {!allProducts.isLoading && !allProducts.error && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allProductData.slice(0, 12).map((product) => (
                  <SolutionCard 
                    key={product.id} 
                    solution={product} 
                    isFailedMigration={product.status === 'Not Migrated Successfully'}
                  />
                ))}
              </div>
            )}
            {allProductData.length > 12 && (
              <p className="text-sm text-gray-500 text-center">
                Showing 12 of {allProductData.length} products
              </p>
            )}
          </div>
        </>
      )}

      {moduleId === 'order-not-gen' && (
        <>
          {/* Detection Alert - Same as Order Monitor but different root cause */}
          <div className={cn(
            "rounded-xl p-4 border",
            stuckCartData.length > 0 
              ? "bg-red-50 border-red-200" 
              : "bg-emerald-50 border-emerald-200"
          )}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{stuckCartData.length > 0 ? '🚨' : '✅'}</span>
              <div>
                <h4 className="font-semibold text-gray-900">Detection Result</h4>
                <p className={stuckCartData.length > 0 ? "text-red-700" : "text-emerald-700"}>
                  {stuckCartData.length > 0 
                    ? `${stuckCartData.length} basket(s) not generating orders (high async count suspected)`
                    : "No baskets stuck due to async issues"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Query: <code className="bg-white/50 px-1 rounded">status=Order Generation</code> + check <code className="bg-white/50 px-1 rounded">csordtelcoa__Order_Generation_Batch_Job_Id__c</code>
                </p>
              </div>
            </div>
          </div>

          {/* Stuck Baskets */}
          {stuckCartData.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-red-800">⚠️ Baskets Not Generating Orders</h3>
                  <p className="text-sm text-red-600">Likely caused by high AsyncApexJob count (&gt;100 pending)</p>
                </div>
                <button
                  onClick={() => stuckCarts.refetch()}
                  disabled={stuckCarts.isFetching}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                >
                  {stuckCarts.isFetching && <Spinner size="sm" className="border-white border-t-transparent" />}
                  Refresh
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {stuckCartData.map((cart) => <CartCard key={cart.id} cart={cart} />)}
              </div>
            </div>
          )}

          {/* All Stuck Carts (already filtered above) */}
          {stuckCartData.length === 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-700 text-center">
              ✅ No baskets stuck in Order Generation stage
            </div>
          )}

          {/* Remediation Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="font-semibold text-amber-800 flex items-center gap-2">
              🔧 Remediation Action
            </h4>
            <div className="text-amber-700 mt-2 text-sm space-y-2">
              <p><strong>Step 1:</strong> Check Salesforce AsyncApexJob queue</p>
              <p><strong>Step 2:</strong> If &gt;100 pending jobs, wait or clear stale jobs</p>
              <p><strong>Step 3:</strong> Update basket field:</p>
              <code className="block bg-amber-100 p-2 rounded mt-1 text-xs">
                csordtelcoa__Order_Generation_Batch_Job_Id__c = None
              </code>
              <p className="text-xs text-amber-600 mt-2">This triggers a new order generation batch job</p>
            </div>
          </div>
        </>
      )}

      {moduleId === 'iot-qbs' && (
        <>
          {/* Detection Info - Requires TMF653 for full detection */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔍</span>
              <div>
                <h4 className="font-semibold text-gray-900">Detection Query</h4>
                <p className="text-emerald-700">
                  Finding IoT QBS solutions with corrupted PC linkages
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Needs: <code className="bg-white/50 px-1 rounded">CSPOFA__Process_On_Hold__c = true</code> via TMF653 TaskFlow
                </p>
              </div>
            </div>
          </div>

          {/* Services - Verify linkage */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Active Services</h3>
                <p className="text-sm text-gray-500">TMF638 Service - Verify ICCID, MSISDN, Commitment linkage to PC</p>
              </div>
              <button
                onClick={() => activeServices.refetch()}
                disabled={activeServices.isFetching}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {activeServices.isFetching && <Spinner size="sm" className="border-white border-t-transparent" />}
                Refresh
              </button>
            </div>
            {activeServices.isLoading && <CardLoader message="Loading services..." />}
            {activeServices.error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">Error: {activeServices.error.message}</div>}
            {!activeServices.isLoading && !activeServices.error && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {serviceData.slice(0, 12).map((service) => <ServiceCard key={service.id} service={service} />)}
              </div>
            )}
          </div>

          {/* Orders - In Progress */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Orders In Progress</h3>
                <p className="text-sm text-gray-500">TMF622 ProductOrder - <code className="bg-gray-100 px-1 rounded">state=inProgress</code></p>
              </div>
              <button
                onClick={() => pendingOrders.refetch()}
                disabled={pendingOrders.isFetching}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {pendingOrders.isFetching && <Spinner size="sm" className="border-white border-t-transparent" />}
                Refresh
              </button>
            </div>
            {pendingOrders.isLoading && <CardLoader message="Loading orders..." />}
            {pendingOrders.error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">Error: {pendingOrders.error.message}</div>}
            {!pendingOrders.isLoading && !pendingOrders.error && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pendingOrderData.slice(0, 8).map((order) => <OrderCard key={order.id} order={order} />)}
              </div>
            )}
          </div>

          {/* Missing TMF653 Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="font-semibold text-amber-800 flex items-center gap-2">
              ⚠️ TMF653 TaskFlow/Task - Required for Full Detection
            </h4>
            <div className="text-amber-700 mt-2 text-sm space-y-2">
              <p>To detect stuck orchestration processes, we need:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code className="bg-white/50 px-1 rounded">CSPOFA__Orchestration_Process__c</code> → TMF653 <strong>taskFlow</strong></li>
                <li><code className="bg-white/50 px-1 rounded">CSPOFA__Orchestration_Step__c</code> → TMF653 <strong>task</strong></li>
              </ul>
              <p className="mt-2">Detection query needed:</p>
              <code className="block bg-amber-100 p-2 rounded text-xs">
                CSPOFA__Process_On_Hold__c = true AND CSPOFA__Process_Status__c = 'In Progress'
              </code>
            </div>
          </div>

          {/* Remediation Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              🔧 Remediation Steps (Once TMF653 Available)
            </h4>
            <ul className="text-gray-600 mt-2 text-sm list-disc list-inside space-y-1">
              <li>Identify stuck orchestration processes</li>
              <li>Check PC linkage integrity (ICCID, MSISDN, Commitment)</li>
              <li>Update corrupted <code className="bg-gray-100 px-1 rounded">cscfga__Product_Configuration__c</code> records</li>
              <li>Resume orchestration process</li>
            </ul>
          </div>
        </>
      )}

      {moduleId === 'remediation-history' && (
        <ServiceProblemModule />
      )}
    </div>
  );
}

export default function ModuleDashboard() {
  const [activeModule, setActiveModule] = useState<ModuleType>('order-not-gen');

  // Note: Stats are now fetched in ModulePanel to avoid duplicate calls

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Maxis BSS Magic
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Module Dashboard - CloudSense → TMF APIs
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a 
                href="/executive"
                className="px-4 py-2 bg-[#001d3d] text-white rounded-lg hover:bg-[#002850] transition-all text-sm font-medium"
              >
                📊 Executive View
              </a>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-emerald-700">AWS Singapore</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {modules.map((module) => (
              <button
                key={module.id}
                onClick={() => setActiveModule(module.id)}
                className={cn(
                  "text-center p-4 rounded-xl transition-all",
                  activeModule === module.id 
                    ? "bg-white/20 ring-2 ring-white" 
                    : "bg-white/10 hover:bg-white/15"
                )}
              >
                <div className="text-2xl mb-1">{module.icon}</div>
                <div className="text-sm font-medium truncate">{module.name.split(' ')[0]}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Module Tabs */}
      <div className="container mx-auto px-4">
        <div className="flex gap-1 mt-6 bg-white rounded-xl p-1 shadow-sm border border-gray-200 overflow-x-auto">
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => setActiveModule(module.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                activeModule === module.id
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <span>{module.icon}</span>
              {module.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        <ModulePanel moduleId={activeModule} />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 border-t border-gray-200 pt-6">
          <p>
            Connected to: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
              bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com
            </code>
          </p>
        </div>
      </main>
    </div>
  );
}
