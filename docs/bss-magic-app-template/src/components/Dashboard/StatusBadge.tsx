// Status Badge Component
import { cn } from '../../lib/utils';

interface StatusBadgeProps {
  status: string;
  animated?: boolean;
  className?: string;
}

const statusStyles: Record<string, string> = {
  // Success states
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  
  // In-progress states
  inProgress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  acknowledged: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  
  // Warning states
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  'Order Generation': 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  
  // Error states
  failed: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  'Not Migrated Successfully': 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  
  // Neutral states
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400',
  closed: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400',
  
  // Success (order submitted)
  'Order Submitted': 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
};

export function StatusBadge({ status, animated = false, className }: StatusBadgeProps) {
  const styles = statusStyles[status] || statusStyles.inactive;
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles,
        className
      )}
    >
      {animated && (
        <span className={cn(
          'inline-block h-1.5 w-1.5 rounded-full animate-pulse',
          status === 'active' || status === 'completed' || status === 'resolved' 
            ? 'bg-emerald-400' 
            : status === 'inProgress' || status === 'acknowledged'
            ? 'bg-blue-400'
            : status === 'pending'
            ? 'bg-amber-400'
            : status === 'failed' || status === 'rejected'
            ? 'bg-red-400'
            : 'bg-gray-400'
        )} />
      )}
      {status}
    </span>
  );
}
