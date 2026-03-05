// AlertBadge Component
// Visual alert indicator for categories with increasing issues

import { AlertCircle, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface AlertBadgeProps {
  /** Whether the alert is active */
  active: boolean;
  /** Variant style */
  variant?: 'dot' | 'icon' | 'badge';
  /** Optional label text */
  label?: string;
  /** Pulse animation */
  pulse?: boolean;
  className?: string;
}

export function AlertBadge({
  active,
  variant = 'icon',
  label,
  pulse = true,
  className,
}: AlertBadgeProps) {
  if (!active) return null;

  if (variant === 'dot') {
    return (
      <span
        className={cn(
          'relative flex h-2.5 w-2.5',
          className
        )}
      >
        {pulse && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        )}
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
    );
  }

  if (variant === 'icon') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={cn(
          'text-red-500',
          className
        )}
      >
        <AlertCircle className="w-5 h-5" />
      </motion.div>
    );
  }

  // Badge variant
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
        'bg-red-100 text-red-700 text-xs font-medium',
        'dark:bg-red-900/30 dark:text-red-400',
        className
      )}
    >
      <Bell className="w-3 h-3" />
      {label || 'Alert'}
    </motion.span>
  );
}
