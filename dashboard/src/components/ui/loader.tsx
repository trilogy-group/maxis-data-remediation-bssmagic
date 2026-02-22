/**
 * Totogi BSS Loading Components
 *
 * Provides consistent loading states across the application
 * Uses Totogi branding and color scheme
 */

import React from 'react';
import { cn } from '@/lib/utils';

// Default Spinner Component
export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-neutral-200 border-t-primary-600',
        sizeClasses[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// Totogi Logo Loader (CSS-based spinner with brand colors)
export interface LogoLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LogoLoader({ size = 'md', className }: LogoLoaderProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="relative">
        {/* Outer ring - purple */}
        <div
          className={cn(
            'animate-spin rounded-full border-4 border-purple-200 border-t-purple-600',
            sizeClasses[size],
          )}
        />
        {/* Inner ring - red/pink */}
        <div
          className={cn(
            'absolute inset-2 animate-spin rounded-full border-2 border-red-200 border-b-red-500',
            'animate-reverse-spin',
          )}
          style={{
            animationDirection: 'reverse',
            animationDuration: '1.5s',
          }}
        />
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2 w-2 bg-gradient-to-r from-purple-600 to-red-500 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// Alternative logo loader with orbital animation
export function OrbitalLoader({ size = 'md', className }: LogoLoaderProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className={cn('relative', sizeClasses[size])}>
        {/* Orbiting dots */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="absolute inset-0 animate-spin"
            style={{
              animationDelay: `${i * 0.2}s`,
              animationDuration: '2s',
            }}
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{
                background: i % 2 === 0 ? '#802dc8' : '#ff4f58', // Totogi brand colors
                position: 'absolute',
                top: '0%',
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            />
          </div>
        ))}
        {/* Center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-1 w-1 bg-gray-400 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// Full Page Loader
export interface PageLoaderProps {
  message?: string;
  showLogo?: boolean;
  variant?: 'default' | 'orbital';
}

export function PageLoader({
  message = 'Loading...',
  showLogo = true,
  variant = 'default',
}: PageLoaderProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-4">
        {showLogo ? (
          variant === 'orbital' ? (
            <OrbitalLoader size="lg" />
          ) : (
            <LogoLoader size="lg" />
          )
        ) : (
          <Spinner size="xl" />
        )}
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// Card/Component Loader
export interface CardLoaderProps {
  className?: string;
  message?: string;
}

export function CardLoader({ className, message }: CardLoaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 space-y-4',
        className,
      )}
    >
      <Spinner size="lg" />
      {message && (
        <p className="text-sm text-muted-foreground text-center">{message}</p>
      )}
    </div>
  );
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: simply using the index
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-neutral-200 rounded w-full"></div>
        </td>
      ))}
    </tr>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse space-y-4 p-4', className)}>
      <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
      <div className="space-y-2">
        <div className="h-3 bg-neutral-200 rounded"></div>
        <div className="h-3 bg-neutral-200 rounded w-5/6"></div>
      </div>
      <div className="flex space-x-2">
        <div className="h-6 bg-neutral-200 rounded w-16"></div>
        <div className="h-6 bg-neutral-200 rounded w-20"></div>
      </div>
    </div>
  );
}

export interface LoadingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function LoadingButton({
  loading = false,
  loadingText = 'Loading...',
  children,
  disabled,
  className,
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-md',
        'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50',
        'transition-colors duration-200',
        className,
      )}
    >
      {loading && (
        <Spinner size="sm" className="border-white border-t-transparent" />
      )}
      <span>{loading ? loadingText : children}</span>
    </button>
  );
}
