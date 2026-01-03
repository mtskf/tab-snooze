import { describe, it, expect } from 'vitest';
import {
  validateSnoozedTabs,
  sanitizeSnoozedTabs,
  validateTabEntry
} from './validation';

describe('validation', () => {
  describe('validateTabEntry', () => {
    it('should validate a complete tab entry', () => {
      const tab = {
        url: 'https://example.com',
        creationTime: 1704067200000,
        popTime: 1704153600000,
        title: 'Example', // optional
        favicon: 'https://example.com/favicon.ico' // optional
      };
      const result = validateTabEntry(tab);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null/undefined', () => {
      expect(validateTabEntry(null).valid).toBe(false);
      expect(validateTabEntry(undefined).valid).toBe(false);
    });

    it('should reject non-object', () => {
      expect(validateTabEntry('string').valid).toBe(false);
      expect(validateTabEntry(123).valid).toBe(false);
    });

    it('should require url, creationTime, popTime', () => {
      const result = validateTabEntry({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: url');
      expect(result.errors).toContain('Missing required field: creationTime');
      expect(result.errors).toContain('Missing required field: popTime');
    });

    it('should validate field types', () => {
      const result = validateTabEntry({
        url: 123, // should be string
        creationTime: 'string', // should be number
        popTime: 'string' // should be number
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('url must be a string');
      expect(result.errors).toContain('creationTime must be a number');
      expect(result.errors).toContain('popTime must be a number');
    });
  });

  describe('validateSnoozedTabs', () => {
    it('should validate correct data', () => {
      const data = {
        tabCount: 2,
        '1704067200000': [
          { url: 'https://example1.com', creationTime: 1704000000000, popTime: 1704067200000 },
          { url: 'https://example2.com', creationTime: 1704000001000, popTime: 1704067200000 }
        ]
      };
      const result = validateSnoozedTabs(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null/undefined', () => {
      expect(validateSnoozedTabs(null).valid).toBe(false);
      expect(validateSnoozedTabs(null).repairable).toBe(false);
      expect(validateSnoozedTabs(undefined).valid).toBe(false);
    });

    it('should reject non-object types', () => {
      expect(validateSnoozedTabs('string').valid).toBe(false);
      expect(validateSnoozedTabs([]).valid).toBe(false);
      expect(validateSnoozedTabs(123).valid).toBe(false);
    });

    it('should detect missing tabCount as repairable', () => {
      const data = {
        '1704067200000': [
          { url: 'https://example.com', creationTime: 1704000000000, popTime: 1704067200000 }
        ]
      };
      const result = validateSnoozedTabs(data);
      expect(result.valid).toBe(false);
      expect(result.repairable).toBe(true);
      expect(result.errors).toContain('Missing tabCount key');
    });

    it('should detect invalid tabCount as repairable', () => {
      const data = {
        tabCount: -1,
        '1704067200000': []
      };
      const result = validateSnoozedTabs(data);
      expect(result.valid).toBe(false);
      expect(result.repairable).toBe(true);
    });

    it('should report invalid timestamp keys', () => {
      const data = {
        tabCount: 0,
        'invalid-key': []
      };
      const result = validateSnoozedTabs(data);
      expect(result.errors.some(e => e.includes('Invalid timestamp key'))).toBe(true);
    });

    it('should report non-array values as not repairable', () => {
      const data = {
        tabCount: 0,
        '1704067200000': 'not an array'
      };
      const result = validateSnoozedTabs(data);
      expect(result.valid).toBe(false);
      expect(result.repairable).toBe(false);
    });

    it('should validate empty data with tabCount 0', () => {
      const result = validateSnoozedTabs({ tabCount: 0 });
      expect(result.valid).toBe(true);
    });
  });

  describe('sanitizeSnoozedTabs', () => {
    it('should return empty state for null/undefined', () => {
      expect(sanitizeSnoozedTabs(null)).toEqual({ tabCount: 0 });
      expect(sanitizeSnoozedTabs(undefined)).toEqual({ tabCount: 0 });
    });

    it('should return empty state for non-object', () => {
      expect(sanitizeSnoozedTabs('string')).toEqual({ tabCount: 0 });
      expect(sanitizeSnoozedTabs([])).toEqual({ tabCount: 0 });
    });

    it('should recompute tabCount', () => {
      const data = {
        tabCount: 999, // wrong count
        '1704067200000': [
          { url: 'https://example.com', creationTime: 1704000000000, popTime: 1704067200000 }
        ]
      };
      const sanitized = sanitizeSnoozedTabs(data);
      expect(sanitized.tabCount).toBe(1);
    });

    it('should drop invalid entries', () => {
      const data = {
        tabCount: 2,
        '1704067200000': [
          { url: 'https://valid.com', creationTime: 1704000000000, popTime: 1704067200000 },
          { invalid: 'entry' } // missing required fields
        ]
      };
      const sanitized = sanitizeSnoozedTabs(data);
      expect(sanitized['1704067200000']).toHaveLength(1);
      expect(sanitized.tabCount).toBe(1);
    });

    it('should remove empty timestamp arrays', () => {
      const data = {
        tabCount: 0,
        '1704067200000': [
          { invalid: 'entry' } // will be filtered out
        ]
      };
      const sanitized = sanitizeSnoozedTabs(data);
      expect(sanitized['1704067200000']).toBeUndefined();
    });

    it('should skip non-numeric keys', () => {
      const data = {
        tabCount: 1,
        'invalid-key': [
          { url: 'https://example.com', creationTime: 1704000000000, popTime: 1704067200000 }
        ],
        '1704067200000': [
          { url: 'https://valid.com', creationTime: 1704000000000, popTime: 1704067200000 }
        ]
      };
      const sanitized = sanitizeSnoozedTabs(data);
      expect(sanitized['invalid-key']).toBeUndefined();
      expect(sanitized['1704067200000']).toHaveLength(1);
      expect(sanitized.tabCount).toBe(1);
    });

    it('should preserve optional fields', () => {
      const data = {
        tabCount: 1,
        '1704067200000': [
          {
            url: 'https://example.com',
            creationTime: 1704000000000,
            popTime: 1704067200000,
            title: 'Example',
            favicon: 'https://example.com/favicon.ico',
            customField: 'preserved'
          }
        ]
      };
      const sanitized = sanitizeSnoozedTabs(data);
      expect(sanitized['1704067200000'][0].title).toBe('Example');
      expect(sanitized['1704067200000'][0].customField).toBe('preserved');
    });
  });
});
