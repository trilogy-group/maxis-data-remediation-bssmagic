// MetricTile Component
// Displays a single metric value with optional trend indicator

import { cn } from '../../lib/utils';
import { TrendIndicator } from './TrendIndicator';
import type { TrendDirection } from '../../types/health-metrics';

interface MetricTileProps {
  /** Label for the metric */
  label: string;
  /** Numeric value to display */
  value: number;
  /** Optional trend direction */
  trend?: TrendDirection;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether this metric represents something where increase is bad */
  invertTrendColors?: boolean;
  /** Highlight when this is the primary/featured metric */
  featured?: boolean;
  /** Custom class for value text (for semantic coloring) */
  valueClassName?: string;
  className?: string;
}

const sizeClasses = {
  sm: {
    value: 'text-lg font-semibold',
    label: 'text-xs',
    container: 'py-1',
  },
  md: {
    value: 'text-2xl font-bold',
    label: 'text-sm',
    container: 'py-2',
  },
  lg: {
    value: 'text-4xl font-bold',
    label: 'text-base',
    container: 'py-3',
  },
};

export function MetricTile({
  label,
  value,
  trend,
  size = 'sm',
  invertTrendColors = true,
  featured = false,
  valueClassName,
  className,
}: MetricTileProps) {
  const styles = sizeClasses[size];

  return (
    <div
      className={cn(
        'flex flex-col',
        styles.container,
        featured && 'bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3',
        className
      )}
    >
      <span className={cn(
        'text-slate-500 dark:text-slate-400',
        styles.label
      )}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className={cn(
          'tabular-nums',
          styles.value,
          valueClassName || 'text-slate-900 dark:text-slate-100'
        )}>
          {value.toLocaleString()}
        </span>
        {trend && (
          <TrendIndicator
            direction={trend}
            size={size === 'lg' ? 'md' : 'sm'}
            invertColors={invertTrendColors}
          />
        )}
      </div>
    </div>
  );
}

// Grouped metrics display (for sliding windows)
interface MetricGroupProps {
  title: string;
  metrics: Array<{
    label: string;
    value: number;
    trend?: TrendDirection;
  }>;
  invertTrendColors?: boolean;
  className?: string;
}

export function MetricGroup({
  title,
  metrics,
  invertTrendColors = true,
  className,
}: MetricGroupProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <h4 className="text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
        {title}
      </h4>
      <div className="grid grid-cols-3 gap-2">
        {metrics.map((metric, idx) => (
          <MetricTile
            key={idx}
            label={metric.label}
            value={metric.value}
            trend={metric.trend}
            size="sm"
            invertTrendColors={invertTrendColors}
          />
        ))}
      </div>
    </div>
  );
}
