import {
  formatPhoneNumber,
  formatTMFCurrency,
  formatTMFDate,
  getInitials,
  getStatusColorClass,
} from '../utils';

describe('TMF Utility Functions', () => {
  describe('formatTMFDate', () => {
    it('formats valid date string', () => {
      expect(formatTMFDate('2024-01-15T10:30:00Z')).toBe('Jan 15, 2024');
    });

    it('handles undefined date', () => {
      expect(formatTMFDate(undefined)).toBe('N/A');
    });

    it('handles invalid date', () => {
      expect(formatTMFDate('invalid-date')).toBe('Invalid Date');
    });
  });

  describe('formatTMFCurrency', () => {
    it('formats number amount', () => {
      expect(formatTMFCurrency(1234.56)).toBe('$1,234.56');
    });

    it('formats TMF Money object', () => {
      expect(formatTMFCurrency({ value: 1000, unit: 'EUR' })).toBe('€1,000.00');
    });

    it('handles undefined amount', () => {
      expect(formatTMFCurrency(undefined)).toBe('N/A');
    });
  });

  describe('getStatusColorClass', () => {
    it('returns success color for active status', () => {
      expect(getStatusColorClass('active')).toBe('text-success-600');
    });

    it('returns warning color for pending status', () => {
      expect(getStatusColorClass('pending')).toBe('text-warning-600');
    });

    it('returns error color for failed status', () => {
      expect(getStatusColorClass('failed')).toBe('text-error-600');
    });

    it('returns neutral color for undefined status', () => {
      expect(getStatusColorClass(undefined)).toBe('text-neutral-500');
    });
  });

  describe('formatPhoneNumber', () => {
    it('formats 10-digit US number', () => {
      expect(formatPhoneNumber('1234567890')).toBe('(123) 456-7890');
    });

    it('formats 11-digit US number with country code', () => {
      expect(formatPhoneNumber('11234567890')).toBe('+1 (123) 456-7890');
    });

    it('returns original for invalid format', () => {
      expect(formatPhoneNumber('123')).toBe('123');
    });

    it('handles undefined phone', () => {
      expect(formatPhoneNumber(undefined)).toBe('N/A');
    });
  });

  describe('getInitials', () => {
    it('generates initials from full name', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('generates initials from single name', () => {
      expect(getInitials('John')).toBe('JO');
    });

    it('handles undefined name', () => {
      expect(getInitials(undefined)).toBe('??');
    });
  });
});
