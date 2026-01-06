import { describe, it, expect } from 'vitest';
import {
  validateTabEntry,
  validateSnoozedTabsV2,
  sanitizeSnoozedTabsV2,
  isRestorableUrl
} from './validation';

describe('validation', () => {
  describe('isRestorableUrl', () => {
    it('should accept valid http/https URLs', () => {
      expect(isRestorableUrl('https://example.com')).toBe(true);
      expect(isRestorableUrl('http://example.com')).toBe(true);
      expect(isRestorableUrl('https://example.com/path?query=1')).toBe(true);
    });

    it('should reject empty/whitespace strings', () => {
      expect(isRestorableUrl('')).toBe(false);
      expect(isRestorableUrl('   ')).toBe(false);
      expect(isRestorableUrl('\t\n')).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(isRestorableUrl(null)).toBe(false);
      expect(isRestorableUrl(undefined)).toBe(false);
      expect(isRestorableUrl(123)).toBe(false);
      expect(isRestorableUrl({})).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isRestorableUrl('not-a-url')).toBe(false);
      expect(isRestorableUrl('://invalid')).toBe(false);
    });

    it('should reject restricted protocols', () => {
      expect(isRestorableUrl('chrome://extensions')).toBe(false);
      expect(isRestorableUrl('chrome-extension://id/page.html')).toBe(false);
      expect(isRestorableUrl('file:///local/path')).toBe(false);
      expect(isRestorableUrl('about:blank')).toBe(false);
      expect(isRestorableUrl('edge://settings')).toBe(false);
      expect(isRestorableUrl('brave://settings')).toBe(false);
    });
  });


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

  describe('validateSnoozedTabsV2', () => {
    it('should validate correct V2 structure', () => {
      const data = {
        items: {
          'uuid-1': { id: 'uuid-1', url: 'https://example.com', creationTime: 1704000000000, popTime: 1704067200000 }
        },
        schedule: {
          '1704067200000': ['uuid-1']
        }
      };
      const result = validateSnoozedTabsV2(data);
      expect(result.valid).toBe(true);
    });

    it('should reject missing items or schedule', () => {
      expect(validateSnoozedTabsV2({ items: {} }).valid).toBe(false);
      expect(validateSnoozedTabsV2({ schedule: {} }).valid).toBe(false);
      expect(validateSnoozedTabsV2(null).valid).toBe(false);
    });

    it('should detect orphaned schedule references', () => {
      const data = {
        items: {},
        schedule: { '1704067200000': ['missing-id'] }
      };
      const result = validateSnoozedTabsV2(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing item ID'))).toBe(true);
    });

    it('should detect ID mismatch between key and item.id', () => {
      const data = {
        items: {
          'uuid-1': { id: 'uuid-different', url: 'https://example.com', creationTime: 1704000000000, popTime: 1704067200000 }
        },
        schedule: {}
      };
      const result = validateSnoozedTabsV2(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('ID Validation Mismatch'))).toBe(true);
    });
  });

  describe('sanitizeSnoozedTabsV2', () => {
    it('should return empty structure for null/undefined', () => {
      expect(sanitizeSnoozedTabsV2(null)).toEqual({ items: {}, schedule: {} });
      expect(sanitizeSnoozedTabsV2(undefined)).toEqual({ items: {}, schedule: {} });
    });

    it('should return empty structure for non-object', () => {
      expect(sanitizeSnoozedTabsV2('string')).toEqual({ items: {}, schedule: {} });
    });

    it('should remove invalid items', () => {
      const data = {
        items: {
          'uuid-1': { id: 'uuid-1', url: 'https://valid.com', creationTime: 1704000000000, popTime: 1704067200000 },
          'uuid-2': { invalid: 'entry' } // missing required fields
        },
        schedule: {
          '1704067200000': ['uuid-1', 'uuid-2']
        }
      };
      const sanitized = sanitizeSnoozedTabsV2(data);
      expect(Object.keys(sanitized.items)).toHaveLength(1);
      expect(sanitized.items['uuid-1']).toBeDefined();
      expect(sanitized.items['uuid-2']).toBeUndefined();
    });

    it('should remove orphaned schedule entries', () => {
      const data = {
        items: {
          'uuid-1': { id: 'uuid-1', url: 'https://valid.com', creationTime: 1704000000000, popTime: 1704067200000 }
        },
        schedule: {
          '1704067200000': ['uuid-1', 'uuid-missing'],
          '1704153600000': ['uuid-gone'] // all IDs missing
        }
      };
      const sanitized = sanitizeSnoozedTabsV2(data);
      expect(sanitized.schedule['1704067200000']).toEqual(['uuid-1']);
      expect(sanitized.schedule['1704153600000']).toBeUndefined();
    });

    it('should remove items with ID mismatch', () => {
      const data = {
        items: {
          'uuid-1': { id: 'uuid-wrong', url: 'https://valid.com', creationTime: 1704000000000, popTime: 1704067200000 }
        },
        schedule: { '1704067200000': ['uuid-1'] }
      };
      const sanitized = sanitizeSnoozedTabsV2(data);
      expect(Object.keys(sanitized.items)).toHaveLength(0);
      expect(sanitized.schedule['1704067200000']).toBeUndefined();
    });

    it('should remove items with non-restorable URLs (chrome://, etc.)', () => {
      const data = {
        items: {
          'uuid-1': { id: 'uuid-1', url: 'chrome://extensions', creationTime: 1704000000000, popTime: 1704067200000 },
          'uuid-2': { id: 'uuid-2', url: 'chrome-extension://abc123/page.html', creationTime: 1704000000000, popTime: 1704067200000 },
          'uuid-3': { id: 'uuid-3', url: 'https://valid.com', creationTime: 1704000000000, popTime: 1704067200000 }
        },
        schedule: {
          '1704067200000': ['uuid-1', 'uuid-2', 'uuid-3']
        }
      };
      const sanitized = sanitizeSnoozedTabsV2(data);
      expect(Object.keys(sanitized.items)).toHaveLength(1);
      expect(sanitized.items['uuid-1']).toBeUndefined();
      expect(sanitized.items['uuid-2']).toBeUndefined();
      expect(sanitized.items['uuid-3']).toBeDefined();
      expect(sanitized.schedule['1704067200000']).toEqual(['uuid-3']);
    });

    it('should remove items with other restricted protocols', () => {
      const data = {
        items: {
          'uuid-1': { id: 'uuid-1', url: 'file:///local/path', creationTime: 1704000000000, popTime: 1704067200000 },
          'uuid-2': { id: 'uuid-2', url: 'about:blank', creationTime: 1704000000000, popTime: 1704067200000 },
          'uuid-3': { id: 'uuid-3', url: 'edge://settings', creationTime: 1704000000000, popTime: 1704067200000 },
          'uuid-4': { id: 'uuid-4', url: 'brave://settings', creationTime: 1704000000000, popTime: 1704067200000 }
        },
        schedule: {
          '1704067200000': ['uuid-1', 'uuid-2', 'uuid-3', 'uuid-4']
        }
      };
      const sanitized = sanitizeSnoozedTabsV2(data);
      expect(Object.keys(sanitized.items)).toHaveLength(0);
      expect(sanitized.schedule['1704067200000']).toBeUndefined();
    });

    it('should preserve valid items and schedule', () => {
      const data = {
        items: {
          'uuid-1': { id: 'uuid-1', url: 'https://example.com', creationTime: 1704000000000, popTime: 1704067200000, title: 'Test' }
        },
        schedule: {
          '1704067200000': ['uuid-1']
        }
      };
      const sanitized = sanitizeSnoozedTabsV2(data);
      expect(sanitized.items['uuid-1'].title).toBe('Test');
      expect(sanitized.schedule['1704067200000']).toEqual(['uuid-1']);
    });
  });
});
