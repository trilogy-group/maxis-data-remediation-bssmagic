// Shopping Cart Card Component (TMF663)
import type { ShoppingCart } from '../../types/tmf-api';
import { StatusBadge } from './StatusBadge';
import { cn } from '../../lib/utils';

interface ShoppingCartCardProps {
  cart: ShoppingCart;
  className?: string;
}

export function ShoppingCartCard({ cart, className }: ShoppingCartCardProps) {
  const isStuck = cart.status === 'Order Generation';
  
  return (
    <div className={cn(
      'rounded-lg border bg-white dark:bg-gray-800 p-4 hover:shadow-md transition-shadow',
      isStuck 
        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10' 
        : 'border-gray-200 dark:border-gray-700',
      className
    )}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isStuck && (
                <span className="text-amber-500" title="Stuck Basket">⚠️</span>
              )}
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {cart.name || 'Unnamed Cart'}
              </h3>
            </div>
            <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate mt-1">
              {cart.id}
            </p>
          </div>
          <StatusBadge status={cart.status || 'Unknown'} />
        </div>
        
        {/* Details */}
        <div className="space-y-2 text-sm">
          {cart.creationDate && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">Created:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {new Date(cart.creationDate).toLocaleDateString()}
              </span>
            </div>
          )}
          {cart.lastUpdate && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">Last Update:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {new Date(cart.lastUpdate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
        
        {isStuck && (
          <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
            <div className="text-xs text-amber-700 dark:text-amber-300">
              ⚠️ This basket is stuck in Order Generation. High AsyncApexJob queue may be preventing order generation.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
