import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectSchemaVersion,
  runMigrations,
  ensureValidStorage,
  CURRENT_SCHEMA_VERSION,
  SCHEMA_MIGRATIONS
} from './schemaVersioning.js';

describe('Schema Versioning', () => {
  describe('detectSchemaVersion', () => {
    it('returns null for null/undefined data', () => {
      expect(detectSchemaVersion(null)).toBe(null);
      expect(detectSchemaVersion(undefined)).toBe(null);
    });

    it('returns 1 for V1 legacy data (has tabCount)', () => {
      const v1Data = { tabCount: 0 };
      expect(detectSchemaVersion(v1Data)).toBe(1);
    });

    it('returns 1 for V1 legacy data with timestamp keys', () => {
      const v1Data = {
        tabCount: 1,
        '1234567890': [{ url: 'https://example.com', popTime: 1234567890, creationTime: 1234567800 }]
      };
      expect(detectSchemaVersion(v1Data)).toBe(1);
    });

    it('returns 2 for V2 data without version field', () => {
      const v2Data = { items: {}, schedule: {} };
      expect(detectSchemaVersion(v2Data)).toBe(2);
    });

    it('returns the version number from versioned V2 data', () => {
      const v2Data = { version: 2, items: {}, schedule: {} };
      expect(detectSchemaVersion(v2Data)).toBe(2);
    });

    it('returns version number for future schemas (V3)', () => {
      const v3Data = { version: 3, items: {}, schedule: {}, newField: {} };
      expect(detectSchemaVersion(v3Data)).toBe(3);
    });
  });

  describe('SCHEMA_MIGRATIONS registry', () => {
    it('has migration function from V1 to V2', () => {
      expect(SCHEMA_MIGRATIONS).toHaveProperty('1');
      expect(typeof SCHEMA_MIGRATIONS[1]).toBe('function');
    });

    it('CURRENT_SCHEMA_VERSION is defined as 2', () => {
      expect(CURRENT_SCHEMA_VERSION).toBe(2);
    });
  });

  describe('runMigrations', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('migrates V1 to V2', async () => {
      const v1Data = {
        tabCount: 1,
        '1234567890': [{
          id: 'old-id',
          url: 'https://example.com',
          title: 'Example',
          popTime: 1234567890,
          creationTime: 1234567800
        }]
      };

      const result = await runMigrations(v1Data, 1, 2);

      expect(result.version).toBe(2);
      expect(result.items).toBeDefined();
      expect(result.schedule).toBeDefined();
      expect(Object.keys(result.items).length).toBeGreaterThan(0);
    });

    it('returns data unchanged if already at target version', async () => {
      const v2Data = { version: 2, items: {}, schedule: {} };
      const result = await runMigrations(v2Data, 2, 2);
      expect(result).toEqual(v2Data);
    });

    it('runs multiple migrations sequentially (V1 -> V2 -> V3)', async () => {
      // Setup mock V2->V3 migration for testing
      const originalMigrations = { ...SCHEMA_MIGRATIONS };
      SCHEMA_MIGRATIONS[2] = vi.fn((data) => ({
        ...data,
        version: 3,
        newField: {}
      }));

      const v1Data = {
        tabCount: 1,
        '1234567890': [{
          url: 'https://example.com',
          popTime: 1234567890,
          creationTime: 1234567800
        }]
      };

      const result = await runMigrations(v1Data, 1, 3);

      expect(result.version).toBe(3);
      expect(SCHEMA_MIGRATIONS[2]).toHaveBeenCalled();

      // Cleanup
      SCHEMA_MIGRATIONS[2] = originalMigrations[2];
    });
  });

  describe('ensureValidStorage', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Mock chrome.storage.local
      global.chrome = {
        storage: {
          local: {
            get: vi.fn(),
            set: vi.fn()
          }
        }
      };
    });

    it('returns valid V2 data with version field added', async () => {
      const v2Data = {
        items: {
          'id-1': { id: 'id-1', url: 'https://example.com', popTime: 123, creationTime: 100 }
        },
        schedule: { '123': ['id-1'] }
      };

      chrome.storage.local.get.mockResolvedValue({ snoooze_v2: v2Data });

      const result = await ensureValidStorage();

      expect(result.version).toBe(2);
      expect(result.items).toEqual(v2Data.items);
      expect(result.schedule).toEqual(v2Data.schedule);
    });

    it('migrates V1 legacy data to V2', async () => {
      const v1Data = {
        tabCount: 1,
        '1234567890': [{
          url: 'https://example.com',
          title: 'Example',
          popTime: 1234567890,
          creationTime: 1234567800
        }]
      };

      chrome.storage.local.get.mockResolvedValue({ snoozedTabs: v1Data });

      const result = await ensureValidStorage();

      expect(result.version).toBe(2);
      expect(result.items).toBeDefined();
      expect(result.schedule).toBeDefined();
    });

    it('sanitizes invalid V2 data', async () => {
      const invalidV2 = {
        version: 2,
        items: {
          'id-1': { id: 'id-1', url: 'https://example.com', popTime: 123, creationTime: 100 },
          'id-2': { id: 'id-2' } // Missing required fields
        },
        schedule: {
          '123': ['id-1', 'id-2'],
          '456': ['id-missing'] // Orphaned reference
        }
      };

      chrome.storage.local.get.mockResolvedValue({ snoooze_v2: invalidV2 });

      const result = await ensureValidStorage();

      expect(result.version).toBe(2);
      expect(result.items['id-1']).toBeDefined();
      expect(result.items['id-2']).toBeUndefined(); // Invalid item removed
      expect(result.schedule['123']).toEqual(['id-1']); // Orphaned reference removed
      expect(result.schedule['456']).toBeUndefined(); // Empty schedule entry removed
    });

    it('returns empty V2 structure for null/missing data', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const result = await ensureValidStorage();

      expect(result).toEqual({
        version: 2,
        items: {},
        schedule: {}
      });
    });
  });
});
