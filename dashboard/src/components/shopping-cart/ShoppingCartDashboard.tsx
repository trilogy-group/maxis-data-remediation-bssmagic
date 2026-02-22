'use client';

/**
 * Shopping Cart Dashboard - TMF663
 * Displays shopping carts from BSS Magic Runtime with detailed cart item info
 */

import { useState, useCallback } from 'react';
import { 
  ShoppingCart, Package, DollarSign, Clock, ChevronDown, ChevronRight, 
  RefreshCw, User, Calendar, Hash, FileText, Layers, CreditCard,
  Tag, Box, Info, ExternalLink, Settings
} from 'lucide-react';
import { useShoppingCartList } from '@/tmf/shoppingCart/shopping-cart/hooks';

// TMF API response types (flexible to handle actual API response)
interface ShoppingCartType {
  id: string;
  name?: string;
  status?: string;
  description?: string;
  href?: string;
  creationDate?: string;
  lastUpdate?: string;
  validFor?: { startDateTime?: string; endDateTime?: string };
  cartTotalPrice?: Array<{ price?: { value?: number; unit?: string }; priceType?: string }>;
  relatedParty?: Array<{ id?: string; name?: string; role?: string }>;
  cartItem?: CartItemDetail[];
}

interface CartItemDetail {
  id: string;
  name?: string;
  action?: string;
  status?: string;
  quantity?: number;
  product?: { id?: string; name?: string };
  productOffering?: { id?: string; name?: string };
  solutionName?: string;
  productFamily?: string;
  oneOffCharge?: number;
  recurringCharge?: number;
  totalContractValue?: number;
  contractTerm?: number;
  billingFrequency?: number;
  currency?: string;
  productDefinitionId?: string;
  guid?: string;
  solutionId?: string;
  createdDate?: string;
  lastModifiedDate?: string;
  parentConfigurationId?: string;
}
import { Spinner } from '@/components/ui/loader';
import { OrderEnrichmentPanel } from './OrderEnrichmentPanel';

function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

function formatCurrency(value?: number, currency?: string): string {
  if (value === undefined || value === null) return 'N/A';
  const curr = currency || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
  }).format(value);
}

function formatPrice(price?: { value?: number; unit?: string }): string {
  if (!price?.value) return 'N/A';
  return formatCurrency(price.value, price.unit);
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: any }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {Icon && <Icon className="h-4 w-4 text-neutral-400 mt-0.5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <span className="text-xs text-neutral-500">{label}</span>
        <div className="text-sm font-medium text-neutral-900 truncate">{value || 'N/A'}</div>
      </div>
    </div>
  );
}

function CartItemDetailCard({ item }: { item: CartItemDetail }) {
  const [showRaw, setShowRaw] = useState(false);
  
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      {/* Item Header */}
      <div className="flex items-start justify-between mb-3 pb-3 border-b border-neutral-100">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-50">
            <Package className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900">{item.name || item.id}</h4>
            <p className="text-xs text-neutral-500 font-mono">{item.id}</p>
            {item.solutionName && (
              <p className="text-xs text-orange-600 mt-0.5">Solution: {item.solutionName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            item.action === 'add' ? 'bg-green-100 text-green-700' :
            item.action === 'modify' ? 'bg-blue-100 text-blue-700' :
            item.action === 'delete' ? 'bg-red-100 text-red-700' :
            'bg-neutral-100 text-neutral-600'
          }`}>
            {item.action || 'add'}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            item.status === 'active' ? 'bg-green-100 text-green-700' :
            'bg-neutral-100 text-neutral-600'
          }`}>
            {item.status || 'active'}
          </span>
        </div>
      </div>

      {/* Item Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
        <InfoRow icon={Hash} label="Quantity" value={item.quantity || 1} />
        <InfoRow icon={Tag} label="Product Family" value={item.productFamily} />
        <InfoRow icon={FileText} label="Config Status" value={item.status} />
        
        {/* Pricing Section */}
        <InfoRow 
          icon={DollarSign} 
          label="One-Off Charge" 
          value={item.oneOffCharge ? formatCurrency(item.oneOffCharge, item.currency || undefined) : 'N/A'} 
        />
        <InfoRow 
          icon={CreditCard} 
          label="Recurring Charge" 
          value={item.recurringCharge ? formatCurrency(item.recurringCharge, item.currency || undefined) : 'N/A'} 
        />
        <InfoRow 
          icon={DollarSign} 
          label="Total Contract Value" 
          value={item.totalContractValue ? formatCurrency(item.totalContractValue, item.currency || undefined) : 'N/A'} 
        />
        
        {/* Contract Info */}
        <InfoRow icon={Calendar} label="Contract Term" value={item.contractTerm ? `${item.contractTerm} months` : 'N/A'} />
        <InfoRow icon={Clock} label="Billing Frequency" value={
          item.billingFrequency === 1 ? 'Monthly' :
          item.billingFrequency === 12 ? 'Yearly' :
          item.billingFrequency === 0.25 ? 'Quarterly' :
          item.billingFrequency ? `${item.billingFrequency}` : 'N/A'
        } />
        <InfoRow icon={Box} label="Currency" value={item.currency} />
        
        {/* IDs */}
        <InfoRow icon={Layers} label="Product Definition" value={
          <span className="font-mono text-xs">{item.productDefinitionId || 'N/A'}</span>
        } />
        <InfoRow icon={Hash} label="GUID" value={
          <span className="font-mono text-xs">{item.guid || 'N/A'}</span>
        } />
        <InfoRow icon={Layers} label="Solution ID" value={
          <span className="font-mono text-xs">{item.solutionId || 'N/A'}</span>
        } />
        
        {/* Dates */}
        <InfoRow icon={Calendar} label="Created" value={formatDate(item.createdDate || undefined)} />
        <InfoRow icon={Calendar} label="Last Modified" value={formatDate(item.lastModifiedDate || undefined)} />
        {item.parentConfigurationId && (
          <InfoRow icon={Layers} label="Parent Config" value={
            <span className="font-mono text-xs">{item.parentConfigurationId}</span>
          } />
        )}
      </div>

      {/* Raw Data Toggle */}
      <div className="mt-3 pt-3 border-t border-neutral-100">
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <Info className="h-3 w-3" />
          {showRaw ? 'Hide' : 'Show'} Raw Data
        </button>
        {showRaw && (
          <pre className="mt-2 p-2 bg-neutral-50 rounded text-xs overflow-x-auto max-h-48">
            {JSON.stringify(item, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function ShoppingCartCard({ 
  cart, 
  isExpanded, 
  onToggle
}: { 
  cart: ShoppingCartType; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'items' | 'oe'>('items');
  const totalPrice = cart.cartTotalPrice?.[0]?.price;
  const itemCount = cart.cartItem?.length || 0;
  const customer = cart.relatedParty?.[0];

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary-50">
              <ShoppingCart className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900">{cart.name || cart.id}</h3>
              <p className="text-xs text-neutral-500 font-mono">{cart.id}</p>
              {customer?.name && (
                <div className="flex items-center gap-1 mt-1 text-xs text-neutral-600">
                  <User className="h-3 w-3" />
                  <span>{customer.name}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              cart.status === 'Active' || cart.status === 'active' ? 'bg-green-100 text-green-700' :
              cart.status === 'Draft' || cart.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
              cart.status === 'Submitted' || cart.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
              cart.status === 'Requires Update' ? 'bg-orange-100 text-orange-700' :
              'bg-neutral-100 text-neutral-600'
            }`}>
              {cart.status || 'N/A'}
            </span>
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-neutral-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-neutral-400" />
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-neutral-100">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-500">Total</p>
              <p className="text-sm font-semibold text-neutral-900">{formatPrice(totalPrice)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-500">Items</p>
              <p className="text-sm font-semibold text-neutral-900">{itemCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-500">Created</p>
              <p className="text-sm font-semibold text-neutral-900">{formatDate(cart.creationDate)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content - Shopping Cart Details */}
      {isExpanded && (
        <div className="border-t border-neutral-100">
          {/* Shopping Cart Full Details */}
          <div className="p-4 bg-neutral-50">
            <h4 className="text-sm font-semibold text-neutral-700 mb-3">Shopping Cart Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoRow icon={Hash} label="ID" value={<span className="font-mono text-xs">{cart.id}</span>} />
              <InfoRow icon={ExternalLink} label="HREF" value={
                <a href={cart.href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-xs truncate block">
                  {cart.href || 'N/A'}
                </a>
              } />
              <InfoRow icon={FileText} label="Name" value={cart.name} />
              <InfoRow icon={FileText} label="Description" value={cart.description} />
              <InfoRow icon={Tag} label="Status" value={cart.status} />
              <InfoRow icon={Calendar} label="Created" value={formatDate(cart.creationDate)} />
              <InfoRow icon={Calendar} label="Last Update" value={formatDate(cart.lastUpdate)} />
              <InfoRow icon={Calendar} label="Valid From" value={formatDate(cart.validFor?.startDateTime)} />
              <InfoRow icon={Calendar} label="Valid To" value={formatDate(cart.validFor?.endDateTime)} />
              <InfoRow icon={DollarSign} label="Total Price" value={formatPrice(totalPrice)} />
              <InfoRow icon={User} label="Customer" value={customer?.name} />
              <InfoRow icon={Hash} label="Customer ID" value={<span className="font-mono text-xs">{customer?.id}</span>} />
            </div>
            
            {/* Raw Shopping Cart Data */}
            <details className="mt-3">
              <summary className="text-xs text-primary-600 cursor-pointer hover:text-primary-700">
                View Raw Shopping Cart Data
              </summary>
              <pre className="mt-2 p-2 bg-white rounded border border-neutral-200 text-xs overflow-x-auto max-h-48">
                {JSON.stringify(cart, null, 2)}
              </pre>
            </details>
          </div>
          
          {/* Tabs for Items vs OE Data */}
          <div className="border-b border-neutral-200 bg-white">
            <div className="flex">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('items'); }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'items'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <Package className="h-4 w-4" />
                Cart Items ({itemCount})
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveTab('oe'); }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'oe'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <Settings className="h-4 w-4" />
                Order Enrichment
              </button>
            </div>
          </div>
          
          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'items' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-neutral-700">
                    Cart Items ({itemCount})
                  </h4>
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                    Direct PostgreSQL API
                  </span>
                </div>

                {/* Cart Items - Direct from API (includes full details) */}
                {cart.cartItem && cart.cartItem.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs text-green-600 font-medium">✓ {cart.cartItem.length} items loaded with full details</p>
                    {cart.cartItem.map((item, idx) => (
                      <CartItemDetailCard key={item.id || idx} item={item as CartItemDetail} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 text-center py-4">No cart items found</p>
                )}
              </>
            )}
            
            {activeTab === 'oe' && (
              <OrderEnrichmentPanel 
                basketId={cart.id} 
                cartName={cart.name}
                cartItems={cart.cartItem as CartItemDetail[]}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ShoppingCartDashboard() {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  const { data, isLoading, error, refetch, isFetching } = useShoppingCartList({ limit: 10 });

  const toggleCard = useCallback((id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="xl" />
          <p className="text-sm text-neutral-600">Loading shopping carts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isDockerError = error.message.includes('docker') || error.message.includes('Docker');
    
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-amber-900">Shopping Cart Setup Required</h3>
              <p className="mt-2 text-sm text-amber-700">
                {isDockerError 
                  ? 'The direct PostgreSQL API requires Docker to be running with the BSS Magic runtime container.'
                  : `Error: ${error.message}`
                }
              </p>
              
              {isDockerError && (
                <div className="mt-4 p-4 bg-white/50 rounded-lg border border-amber-200">
                  <h4 className="font-medium text-amber-800 mb-2">To enable Shopping Carts locally:</h4>
                  <ol className="text-sm text-amber-700 space-y-2 list-decimal list-inside">
                    <li>Start Docker Desktop</li>
                    <li>Run the BSS Magic Runtime container:
                      <code className="block mt-1 ml-4 p-2 bg-amber-100 rounded text-xs font-mono">
                        docker-compose up -d
                      </code>
                    </li>
                    <li>Refresh this page</li>
                  </ol>
                </div>
              )}
              
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">Alternative: Use AWS Runtime</h4>
                <p className="text-sm text-blue-700">
                  The Shopping Cart API on AWS requires TMF views to be created in PostgreSQL. 
                  Currently, the TMF Server's JsonbRowMapper has a parsing issue with custom fields.
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  ✅ The Service, Party Account, and Billing Account APIs work from AWS - switch to those tabs.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  // Cast API response to our flexible type
  const carts = (data?.data || []) as unknown as ShoppingCartType[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Shopping Carts</h2>
          <p className="text-sm text-neutral-600 mt-1">
            TMF663 Shopping Cart API • Showing {carts.length} carts from BSS Magic Runtime
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-500">Total Carts</p>
          <p className="text-2xl font-bold text-neutral-900">{carts.length}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-500">Total Items</p>
          <p className="text-2xl font-bold text-neutral-900">
            {carts.reduce((sum, c) => sum + (c.cartItem?.length || 0), 0)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-500">Active Carts</p>
          <p className="text-2xl font-bold text-green-600">
            {carts.filter(c => c.status?.toLowerCase() === 'active').length}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-500">With Pricing</p>
          <p className="text-2xl font-bold text-primary-600">
            {carts.filter(c => c.cartTotalPrice?.[0]?.price?.value).length}
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900">Shopping Cart Features</h4>
            <p className="text-sm text-blue-700 mt-1">
              Click on a shopping cart to expand it and view two tabs:
            </p>
            <ul className="text-sm text-blue-700 mt-1 list-disc list-inside">
              <li><strong>Cart Items</strong> - Product configurations with pricing from PostgreSQL</li>
              <li><strong>Order Enrichment</strong> - OE attributes from CloudSense JS API (Billing Account, MSISDN, etc.)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Cart Grid */}
      {carts.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-12 text-center">
          <ShoppingCart className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">No Shopping Carts Found</h3>
          <p className="text-neutral-600">
            No shopping cart data is available from the BSS Magic Runtime.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {carts.map(cart => (
            <ShoppingCartCard
              key={cart.id}
              cart={cart}
              isExpanded={expandedCards.has(cart.id)}
              onToggle={() => toggleCard(cart.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

