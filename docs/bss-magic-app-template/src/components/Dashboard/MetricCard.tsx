// Metric Card Component for Executive Dashboard
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendText?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  className?: string;
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendText,
  icon: Icon, 
  variant = 'default',
  className 
}: MetricCardProps) {
  const variantStyles = {
    default: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    danger: 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-700',
    warning: 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700',
    success: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-300 dark:border-emerald-700',
  };
  
  const trendStyles = {
    up: 'text-emerald-600 dark:text-emerald-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-gray-400',
  };
  
  return (
    <div className={cn(
      'rounded-lg border p-6 transition-all hover:shadow-lg',
      variantStyles[variant],
      className
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            {title}
          </p>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {value}
          </div>
        </div>
        {Icon && (
          <div className={cn(
            'p-3 rounded-lg',
            variant === 'danger' && 'bg-red-100 dark:bg-red-500/20',
            variant === 'warning' && 'bg-amber-100 dark:bg-amber-500/20',
            variant === 'success' && 'bg-emerald-100 dark:bg-emerald-500/20',
            variant === 'default' && 'bg-gray-100 dark:bg-gray-700'
          )}>
            <Icon className={cn(
              'w-6 h-6',
              variant === 'danger' && 'text-red-600 dark:text-red-400',
              variant === 'warning' && 'text-amber-600 dark:text-amber-400',
              variant === 'success' && 'text-emerald-600 dark:text-emerald-400',
              variant === 'default' && 'text-gray-600 dark:text-gray-400'
            )} />
          </div>
        )}
      </div>
      
      {(subtitle || trendText) && (
        <div className="space-y-1">
          {subtitle && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {subtitle}
            </p>
          )}
          {trend && trendText && (
            <div className={cn('text-sm font-medium flex items-center gap-1', trendStyles[trend])}>
              <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
              <span>{trendText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
