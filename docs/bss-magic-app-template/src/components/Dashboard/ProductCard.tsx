// Product/Solution Card Component (TMF637)
import { useState } from 'react';
import type { Product } from '../../types/tmf-api';
import { StatusBadge } from './StatusBadge';
import { cn } from '../../lib/utils';

interface ProductCardProps {
  product: Product;
  onFix?: (productId: string, productName: string) => Promise<void>;
  onViewOE?: (product: Product) => void;
  showFixButton?: boolean;
  className?: string;
}

export function ProductCard({ product, onFix, onViewOE, showFixButton = false, className }: ProductCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [fixing, setFixing] = useState(false);
  
  // Get characteristics
  const getMigrationStatus = () => product.status || 'Unknown';
  const getSolutionStatus = () => {
    const char = product.productCharacteristic?.find(c => c.name === 'solutionStatus');
    return char?.value?.toString() || 'Unknown';
  };
  const isMigratedToHeroku = () => {
    const char = product.productCharacteristic?.find(c => c.name === 'isMigratedToHeroku');
    return char?.value === true || char?.value === 'true';
  };
  
  const isFailedMigration = getMigrationStatus() === 'Not Migrated Successfully';
  
  const handleFix = async () => {
    if (!onFix) return;
    setFixing(true);
    try {
      await onFix(product.id, product.name || product.id);
    } finally {
      setFixing(false);
    }
  };
  
  return (
    <div className={cn(
      'rounded-lg border bg-white dark:bg-gray-800 p-4 hover:shadow-md transition-shadow',
      isFailedMigration 
        ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10' 
        : 'border-gray-200 dark:border-gray-700',
      className
    )}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isFailedMigration && (
                <span className="text-red-500" title="Failed Migration">⚠️</span>
              )}
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {product.name || 'Unnamed Product'}
              </h3>
            </div>
            <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate mt-1">
              {product.id}
            </p>
            {product.productSerialNumber && (
              <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {product.productSerialNumber}
              </span>
            )}
          </div>
          <StatusBadge status={getMigrationStatus()} />
        </div>
        
        {/* Key Info Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-xs">Migration Status</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{getMigrationStatus()}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-xs">Solution Status</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{getSolutionStatus()}</div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-xs">Migrated to Heroku</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {isMigratedToHeroku() ? '✅' : '❌'}
            </div>
          </div>
          <div>
            <div className="text-gray-500 dark:text-gray-400 text-xs">Is Bundle</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {product.isBundle ? '✅' : '❌'}
            </div>
          </div>
          {product.product && product.product.length > 0 && (
            <div className="col-span-2">
              <div className="text-gray-500 dark:text-gray-400 text-xs">Child Products</div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {product.product.length} subscription{product.product.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
        
        {/* Pricing */}
        {product.productPrice && product.productPrice.length > 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Contract Value</div>
            {product.productPrice.map((price, idx) => (
              <div key={idx} className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {price.price?.taxIncludedAmount?.unit || 'MYR'} {price.price?.taxIncludedAmount?.value || 0}
                </span>
                {price.recurringChargePeriod && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    / {price.recurringChargePeriod}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Expandable Details */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
          >
            {expanded ? '▼ Hide Details' : '▶ Show More Details'}
          </button>
          
          {expanded && (
            <div className="mt-3 space-y-2 text-sm">
              {/* Customer */}
              {product.relatedParty?.find(p => p.role === 'customer') && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Customer:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {product.relatedParty.find(p => p.role === 'customer')?.partyOrPartyRole?.name || 'N/A'}
                  </span>
                </div>
              )}
              
              {/* Billing Account */}
              {product.billingAccount && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Billing Account:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {product.billingAccount.name || product.billingAccount.id}
                  </span>
                </div>
              )}
              
              {/* Dates */}
              <div className="grid grid-cols-2 gap-2">
                {product.creationDate && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">Created</div>
                    <div className="text-gray-900 dark:text-gray-100">
                      {new Date(product.creationDate).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {product.startDate && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">Start</div>
                    <div className="text-gray-900 dark:text-gray-100">
                      {new Date(product.startDate).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Child Products */}
              {product.product && product.product.length > 0 && (
                <div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Child Products:</div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {product.product.map((child, idx) => (
                      <div key={idx} className="text-xs font-mono text-gray-700 dark:text-gray-300">
                        {child.productRef?.name || child.productRef?.id}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          {onViewOE && (
            <button
              onClick={() => onViewOE(product)}
              className="flex-1 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
            >
              Show What's Missing
            </button>
          )}
          {showFixButton && isFailedMigration && (
            <button
              onClick={handleFix}
              disabled={fixing}
              className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 dark:bg-emerald-500 rounded hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              {fixing ? '⏳ Fixing...' : `✅ Fix Now (${product.productPrice?.[0]?.price?.taxIncludedAmount 
                ? `${product.productPrice[0].price.taxIncludedAmount.unit || 'MYR'} ${Math.round((product.productPrice[0].price.taxIncludedAmount.value || 0) / 1000)}K` 
                : 'Fix'})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
