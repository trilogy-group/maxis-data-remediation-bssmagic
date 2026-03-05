// Product Order Card Component (TMF622)
import type { ProductOrder } from '../../types/tmf-api';
import { StatusBadge } from './StatusBadge';
import { cn } from '../../lib/utils';

interface ProductOrderCardProps {
  order: ProductOrder;
  className?: string;
}

export function ProductOrderCard({ order, className }: ProductOrderCardProps) {
  const orderNumber = order.externalId?.[0]?.id || order.id;
  const customerName = order.relatedParty?.find(p => p.role === 'customer')?.partyOrPartyRole?.name;
  
  return (
    <div className={cn('rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:shadow-md transition-shadow', className)}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              Order {orderNumber}
            </h3>
            {customerName && (
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                {customerName}
              </p>
            )}
          </div>
          <StatusBadge status={order.state || 'Unknown'} />
        </div>
        
        {/* Details */}
        <div className="space-y-2 text-sm">
          {order.category && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">Category:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">{order.category}</span>
            </div>
          )}
          {order.creationDate && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">Created:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {new Date(order.creationDate).toLocaleDateString()}
              </span>
            </div>
          )}
          {order.completionDate && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">Completed:</span>
              <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">
                {new Date(order.completionDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
