import { type ClassValue, clsx } from 'clsx';
import { format } from 'date-fns';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx and tailwind-merge for optimal class handling
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * TMF-specific utility functions for common data formatting
 */

/**
 * Format TMF date strings to human-readable format
 * Handles undefined/null dates gracefully
 */
export function formatTMFDate(date: string | undefined): string {
  if (!date) return 'N/A';
  try {
    return format(new Date(date), 'MMM dd, yyyy');
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Format TMF datetime strings to human-readable format with time
 */
export function formatTMFDateTime(date: string | undefined): string {
  if (!date) return 'N/A';
  try {
    return format(new Date(date), 'MMM dd, yyyy HH:mm');
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Format currency amounts with proper locale formatting
 * Handles TMF Money objects and raw numbers
 */
export function formatTMFCurrency(
  amount: number | undefined | { value?: number; unit?: string },
  defaultCurrency = 'USD',
): string {
  if (amount === undefined || amount === null) return 'N/A';

  let value: number;
  let currency: string;

  if (typeof amount === 'number') {
    value = amount;
    currency = defaultCurrency;
  } else {
    value = amount.value ?? 0;
    currency = amount.unit ?? defaultCurrency;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/**
 * Format TMF status values with proper capitalization
 */
export function formatTMFStatus(status: string | undefined): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

/**
 * Get status color class for TMF status values
 * Returns Tailwind color classes based on common TMF status patterns
 */
export function getStatusColorClass(status: string | undefined): string {
  if (!status) return 'text-neutral-500';

  const normalizedStatus = status.toLowerCase();

  // Success states
  if (
    ['active', 'completed', 'resolved', 'closed', 'delivered'].includes(
      normalizedStatus,
    )
  ) {
    return 'text-success-600';
  }

  // Warning states
  if (
    ['pending', 'held', 'suspended', 'inprogress', 'partial'].includes(
      normalizedStatus,
    )
  ) {
    return 'text-warning-600';
  }

  // Error states
  if (
    ['failed', 'cancelled', 'rejected', 'terminated', 'aborted'].includes(
      normalizedStatus,
    )
  ) {
    return 'text-error-600';
  }

  // Draft/inactive states
  if (['draft', 'inactive', 'acknowledged'].includes(normalizedStatus)) {
    return 'text-neutral-500';
  }

  return 'text-neutral-700';
}

/**
 * Get background color class for status badges
 */
export function getStatusBgColorClass(status: string | undefined): string {
  if (!status) return 'bg-neutral-100';

  const normalizedStatus = status.toLowerCase();

  if (
    ['active', 'completed', 'resolved', 'closed', 'delivered'].includes(
      normalizedStatus,
    )
  ) {
    return 'bg-success-100';
  }

  if (
    ['pending', 'held', 'suspended', 'inprogress', 'partial'].includes(
      normalizedStatus,
    )
  ) {
    return 'bg-warning-100';
  }

  if (
    ['failed', 'cancelled', 'rejected', 'terminated', 'aborted'].includes(
      normalizedStatus,
    )
  ) {
    return 'bg-error-100';
  }

  if (['draft', 'inactive', 'acknowledged'].includes(normalizedStatus)) {
    return 'bg-neutral-100';
  }

  return 'bg-neutral-100';
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(
  text: string | undefined,
  maxLength: number,
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string | undefined): string {
  if (!name) return '??';

  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/**
 * Validate TMF ID format (basic validation)
 */
export function isValidTMFId(id: string | undefined): boolean {
  if (!id) return false;
  // Basic validation - TMF IDs are typically alphanumeric with some special chars
  return /^[A-Za-z0-9_-]+$/.test(id);
}

/**
 * Format phone numbers for display
 */
export function formatPhoneNumber(phone: string | undefined): string {
  if (!phone) return 'N/A';

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Format US phone numbers
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  // Format international numbers with country code
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  // Return original if we can't format it
  return phone;
}

/**
 * Generate a random ID for new entities (useful for mocks)
 */
export function generateMockId(prefix: string = 'ID'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`.toUpperCase();
}

/**
 * Deep clone an object (useful for TMF entity manipulation)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (Array.isArray(obj))
    return obj.map((item) => deepClone(item)) as unknown as T;

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}
