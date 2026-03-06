// HealthTrendsDashboard Component
// Main dashboard page for Data Integrity Health Trends
// User Story 1 - Pilot Implementation

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  RefreshCw, 
  Activity, 
  CheckCircle2, 
  AlertTriangle,
  Clock
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { CategoryHealthCard } from './CategoryHealthCard';
import { useHealthDashboard, useRefreshHealthData } from '../../services/healthMetrics/hooks';
import { isHealthCategoryEnabled } from '../../stores/featureFlags';
import type { HealthDashboardData } from '../../types/health-metrics';

interface HealthTrendsDashboardProps {
  className?: string;
  onNavigateToModule?: (moduleId: string) => void;
}

// Map category IDs to module IDs for navigation
const categoryToModuleMap: Record<string, string> = {
  'order-not-generated': 'order-not-gen',
  'partial-data-missing': 'oe-patcher',
  'solution-empty': 'solution-empty',
  'iot-qbs-issues': 'iot-qbs',
};

export function HealthTrendsDashboard({ className, onNavigateToModule }: HealthTrendsDashboardProps) {
  const { data, isLoading, isError, lastUpdated, refetch } = useHealthDashboard();
  const refreshData = useRefreshHealthData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(15 * 60); // 15 minutes in seconds

  // Countdown timer for auto-refresh (updates every minute for display)
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => prev > 0 ? prev - 1 : 15 * 60);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset countdown on data update
  useEffect(() => {
    setCountdown(15 * 60);
  }, [lastUpdated]);

  // Handle card click navigation
  const handleCardClick = (categoryId: string) => {
    const moduleId = categoryToModuleMap[categoryId];
    if (moduleId && onNavigateToModule) {
      onNavigateToModule(moduleId);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (isLoading && !data) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState onRetry={handleManualRefresh} />;
  }

  if (!data) {
    return <EmptyState />;
  }

  const visibleCategories = data.categories.filter(c => isHealthCategoryEnabled(c.categoryId));
  const alertCount = visibleCategories.filter(c => c.hasAlert).length;
  const totalActive = visibleCategories.reduce((sum, c) => sum + c.activeCount, 0);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Data Integrity Health
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Trend visibility for data integrity use cases
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Next update in {formatCountdown(countdown)}</span>
          </div>
          
          {/* Manual refresh button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg',
              'text-sm font-medium',
              'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700',
              'text-slate-700 dark:text-slate-300',
              'transition-colors',
              'disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <SummaryBanner 
        data={data} 
        alertCount={alertCount} 
        totalActive={totalActive} 
      />

      {/* Category Cards Grid */}
      <div className={cn(
        'grid gap-4',
        visibleCategories.length === 1 ? 'grid-cols-1 max-w-md' :
        visibleCategories.length <= 2 ? 'grid-cols-1 md:grid-cols-2' :
        'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
      )}>
        {visibleCategories.map((category, index) => (
          <CategoryHealthCard
            key={category.categoryId}
            metrics={category}
            delay={index * 0.1}
            onClick={() => handleCardClick(category.categoryId)}
            clickable={!!onNavigateToModule}
          />
        ))}
      </div>

      {/* Last Updated Footer */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-500">
        Last updated: {formatTimestamp(lastUpdated)}
      </div>
    </div>
  );
}

// Summary Banner Component
interface SummaryBannerProps {
  data: HealthDashboardData;
  alertCount: number;
  totalActive: number;
}

function SummaryBanner({ data, alertCount, totalActive }: SummaryBannerProps) {
  const statusConfig = {
    healthy: {
      icon: CheckCircle2,
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-400',
      label: 'System Healthy',
      description: 'All metrics within normal ranges',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-400',
      label: 'Attention Required',
      description: 'Some categories showing increased activity',
    },
    critical: {
      icon: Activity,
      bg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-400',
      label: 'Action Required',
      description: 'Multiple categories need attention',
    },
  };

  const config = statusConfig[data.overallStatus];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4',
        config.bg,
        config.border
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon className={cn('w-6 h-6', config.text)} />
          <div>
            <h2 className={cn('font-semibold', config.text)}>
              {config.label}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {config.description}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {totalActive.toLocaleString()}
            </div>
            <div className="text-slate-500 dark:text-slate-400">Total Active</div>
          </div>
          {alertCount > 0 && (
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {alertCount}
              </div>
              <div className="text-slate-500 dark:text-slate-400">Alerts</div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mb-4" />
      <p className="text-slate-500 dark:text-slate-400">Loading health metrics...</p>
    </div>
  );
}

// Error State
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <AlertTriangle className="w-8 h-8 text-red-500 mb-4" />
      <p className="text-slate-900 dark:text-slate-100 font-medium mb-2">
        Failed to load health metrics
      </p>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
        Please check your connection and try again
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        Retry
      </button>
    </div>
  );
}

// Empty State
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Activity className="w-8 h-8 text-slate-400 mb-4" />
      <p className="text-slate-500 dark:text-slate-400">No health data available</p>
    </div>
  );
}

// Helper Functions
function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return 'Unknown';
  try {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return 'Unknown';
  }
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}
