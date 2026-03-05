// CategoryHealthCard Component
// Displays all metrics for a single health category

import { 
  FileX, 
  AlertTriangle, 
  Package, 
  Wifi,
  type LucideIcon 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { MetricTile, MetricGroup } from './MetricTile';
import { AlertBadge } from './AlertBadge';
import type { CategoryHealthMetrics, HealthCategory } from '../../types/health-metrics';
import { getCategoryConfig } from '../../types/health-metrics';

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  FileX,
  AlertTriangle,
  Package,
  Wifi,
};

interface CategoryHealthCardProps {
  metrics: CategoryHealthMetrics;
  /** Animation delay for staggered entrance */
  delay?: number;
  className?: string;
  /** Click handler for navigation */
  onClick?: () => void;
  /** Whether the card is clickable */
  clickable?: boolean;
}

// Semantic color schemes based on status/severity (not category)
// Colors only mean something: red = critical, amber = warning, green = healthy
function getStatusColors(metrics: CategoryHealthMetrics): {
  bg: string;
  border: string;
  icon: string;
  iconBg: string;
  activeColor: string;
} {
  // Critical: has alert AND high active count (> 50) or increasing trend
  if (metrics.hasAlert && (metrics.activeCount > 50 || metrics.activeTrend === 'up')) {
    return {
      bg: 'bg-slate-50 dark:bg-slate-900',
      border: 'border-red-300 dark:border-red-700',
      icon: 'text-red-600 dark:text-red-400',
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      activeColor: 'text-red-600 dark:text-red-400',
    };
  }
  
  // Warning: has alert OR moderate active count (> 10)
  if (metrics.hasAlert || metrics.activeCount > 10) {
    return {
      bg: 'bg-slate-50 dark:bg-slate-900',
      border: 'border-amber-300 dark:border-amber-700',
      icon: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      activeColor: 'text-amber-600 dark:text-amber-400',
    };
  }
  
  // Healthy: low active count, no alert
  return {
    bg: 'bg-slate-50 dark:bg-slate-900',
    border: 'border-slate-200 dark:border-slate-700',
    icon: 'text-slate-600 dark:text-slate-400',
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    activeColor: 'text-slate-700 dark:text-slate-300',
  };
}

export function CategoryHealthCard({
  metrics,
  delay = 0,
  className,
  onClick,
  clickable = false,
}: CategoryHealthCardProps) {
  const config = getCategoryConfig(metrics.categoryId);
  if (!config) return null;

  const colors = getStatusColors(metrics);
  const Icon = iconMap[config.icon] || FileX;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      onClick={clickable ? onClick : undefined}
      className={cn(
        'relative rounded-xl border p-4 group',
        'bg-white dark:bg-slate-900',
        colors.border,
        'shadow-sm transition-all duration-200',
        clickable && 'cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-slate-400 dark:hover:border-slate-500',
        className
      )}
    >
      {/* Alert indicator */}
      {metrics.hasAlert && (
        <div className="absolute -top-2 -right-2">
          <AlertBadge active variant="dot" pulse />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className={cn(
          'p-2 rounded-lg',
          colors.iconBg
        )}>
          <Icon className={cn('w-5 h-5', colors.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {config.name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
            {config.description}
          </p>
        </div>
      </div>

      {/* Active Issues - Featured */}
      <div className={cn(
        'mb-4 p-3 rounded-lg',
        'bg-slate-100 dark:bg-slate-800'
      )}>
        <MetricTile
          label="Currently Active"
          value={metrics.activeCount}
          trend={metrics.activeTrend}
          size="lg"
          featured
          valueClassName={colors.activeColor}
        />
      </div>

      {/* Click hint for navigation */}
      {clickable && (
        <div className="absolute bottom-2 right-2 text-xs text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
          Click to view details →
        </div>
      )}

      {/* Detected Issues */}
      <MetricGroup
        title="Detected"
        metrics={[
          { label: '24h', value: metrics.detected.last24h, trend: metrics.detected24hTrend },
          { label: '7d', value: metrics.detected.last7d },
          { label: '30d', value: metrics.detected.last30d },
        ]}
        className="mb-3"
      />

      {/* Resolved Issues */}
      <MetricGroup
        title="Resolved"
        metrics={[
          { label: '24h', value: metrics.resolved.last24h },
          { label: '7d', value: metrics.resolved.last7d },
          { label: '30d', value: metrics.resolved.last30d },
        ]}
        invertTrendColors={false} // For resolutions, up is good
      />

      {/* Resolution Rate Indicator */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Resolution Rate (30d)
          </span>
          <span className={cn(
            'font-medium',
            getResolutionRateColor(metrics.resolved.last30d, metrics.detected.last30d)
          )}>
            {calculateResolutionRate(metrics.resolved.last30d, metrics.detected.last30d)}%
          </span>
        </div>
        <div className="mt-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={cn(
              'h-full rounded-full transition-all duration-500',
              getResolutionRateBarColor(metrics.resolved.last30d, metrics.detected.last30d)
            )}
            style={{ 
              width: `${Math.min(100, calculateResolutionRate(metrics.resolved.last30d, metrics.detected.last30d))}%` 
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// Helper functions
function calculateResolutionRate(resolved: number, detected: number): number {
  if (detected === 0) return 100;
  return Math.round((resolved / detected) * 100);
}

function getResolutionRateColor(resolved: number, detected: number): string {
  const rate = calculateResolutionRate(resolved, detected);
  if (rate >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (rate >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getResolutionRateBarColor(resolved: number, detected: number): string {
  const rate = calculateResolutionRate(resolved, detected);
  if (rate >= 80) return 'bg-emerald-500';
  if (rate >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}
