/**
 * Schema Versioning System
 *
 * Manages storage schema versions and migrations.
 * Provides a unified entry point for validation, migration, and repair.
 */

import type { StorageV2, SnoozedItemV2 } from '../types';
import { generateUUID } from '../utils/uuid';
import { validateSnoozedTabsV2, sanitizeSnoozedTabsV2 } from '../utils/validation';
import { storage } from '../utils/ChromeApi';
import { RESTRICTED_PROTOCOLS } from '../utils/constants';

/**
 * Validates if a URL is restorable (valid format, not restricted protocol)
 * Mirrors the validation in snooze() function
 */
function isRestorableUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.trim() === '') {
    return false;
  }
  try {
    const parsed = new URL(url);
    if (RESTRICTED_PROTOCOLS.some(p => parsed.protocol === p)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Current schema version
export const CURRENT_SCHEMA_VERSION = 2;

// V1 Legacy data structure (for migration)
interface V1LegacyData {
  tabCount?: number;
  [timestamp: string]: unknown;
}

interface V1TabEntry {
  id?: string;
  url?: string;
  title?: string;
  favicon?: string | null;
  popTime?: number;
  creationTime?: number;
  groupId?: string | null;
  index?: number;
}

type MigrationFunction = (data: V1LegacyData) => StorageV2;

/**
 * Detects the schema version from raw storage data
 */
export function detectSchemaVersion(data: unknown): number | null {
  // Reject null, non-objects, and arrays
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const obj = data as Record<string, unknown>;

  // If version field exists, use it
  if ('version' in obj && typeof obj.version === 'number') {
    return obj.version;
  }

  // V1 Legacy: has tabCount or numeric timestamp keys
  if ('tabCount' in obj) {
    return 1;
  }

  // Check for numeric timestamp keys (V1 pattern)
  const keys = Object.keys(obj);
  const hasNumericKeys = keys.some(key => !isNaN(parseInt(key)) && String(parseInt(key)) === key);
  if (hasNumericKeys) {
    return 1;
  }

  // V2: has items and schedule
  if ('items' in obj && 'schedule' in obj) {
    return 2;
  }

  // Unknown structure
  return null;
}

/**
 * Migrates V1 legacy data to V2 normalized schema
 */
function migrateV1toV2(v1Data: V1LegacyData): StorageV2 {
  const items: Record<string, SnoozedItemV2> = {};
  const schedule: Record<string, string[]> = {};

  for (const key of Object.keys(v1Data)) {
    if (key === 'tabCount') continue;

    const time = parseInt(key, 10);
    if (isNaN(time)) continue;

    const tabs = v1Data[key];
    if (!Array.isArray(tabs)) continue;

    if (!schedule[time]) schedule[time] = [];

    for (const tab of tabs as V1TabEntry[]) {
      // Skip entries with invalid/restricted URLs - they cannot be restored
      if (!isRestorableUrl(tab.url)) {
        continue;
      }

      // Generate unique ID (handle existing IDs from tab data)
      let id = tab.id || generateUUID();
      while (items[id]) {
        id = generateUUID();
      }

      // Ensure popTime field exists (required for validation)
      const entry: SnoozedItemV2 = {
        id,
        url: tab.url,
        title: tab.title,
        favicon: tab.favicon,
        creationTime: tab.creationTime || Date.now(),
        popTime: tab.popTime || time, // Use timestamp key if popTime missing
        groupId: tab.groupId,
        index: tab.index,
      };
      items[id] = entry;
      schedule[time].push(id);
    }
  }

  return {
    version: 2,
    items,
    schedule
  };
}

/**
 * Schema migration registry
 * Maps source version to migration function
 */
export const SCHEMA_MIGRATIONS: Record<number, MigrationFunction> = {
  1: migrateV1toV2,
  // Future: 2: migrateV2toV3,
};

/**
 * Runs migrations sequentially from source version to target version
 */
export async function runMigrations(
  data: unknown,
  sourceVersion: number,
  targetVersion: number
): Promise<StorageV2> {
  if (sourceVersion === targetVersion) {
    return data as StorageV2;
  }

  let currentData = data as V1LegacyData;
  let currentVersion = sourceVersion;

  // Run migrations sequentially
  while (currentVersion < targetVersion) {
    const migrationFn = SCHEMA_MIGRATIONS[currentVersion];

    if (!migrationFn) {
      throw new Error(`No migration found from version ${currentVersion} to ${currentVersion + 1}`);
    }

    currentData = migrationFn(currentData) as unknown as V1LegacyData;
    currentVersion++;
  }

  return currentData as unknown as StorageV2;
}

/**
 * Unified entry point for storage validation, migration, and repair
 *
 * Flow:
 * 1. Load raw storage data
 * 2. Detect schema version
 * 3. Run migrations if needed
 * 4. Validate structure
 * 5. Sanitize if invalid
 * 6. Return valid V2 data with version field
 */
export async function ensureValidStorage(): Promise<StorageV2> {
  // Load all storage data
  const all = await storage.getLocal(null) as Record<string, unknown>;

  // Try V2 data first
  let data = all.snoooze_v2 as StorageV2 | undefined;
  let version = detectSchemaVersion(data);

  // Fall back to V1 legacy if V2 doesn't exist
  if (version === null && all.snoozedTabs) {
    data = all.snoozedTabs as StorageV2 | undefined;
    version = detectSchemaVersion(data);
  }

  // Handle empty/missing data
  if (version === null) {
    return {
      version: CURRENT_SCHEMA_VERSION,
      items: {},
      schedule: {}
    };
  }

  // Run migrations if needed
  if (version < CURRENT_SCHEMA_VERSION) {
    data = await runMigrations(data, version, CURRENT_SCHEMA_VERSION);
  }

  // Ensure version field exists (for V2 data without version)
  if (data && !data.version) {
    data.version = CURRENT_SCHEMA_VERSION;
  }

  // Validate structure
  const validation = validateSnoozedTabsV2(data as StorageV2);

  if (!validation.valid) {
    // Sanitize invalid data
    const sanitized = sanitizeSnoozedTabsV2(data as StorageV2);
    return {
      version: CURRENT_SCHEMA_VERSION,
      ...sanitized
    };
  }

  return data as StorageV2;
}
