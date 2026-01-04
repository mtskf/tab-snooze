/**
 * Schema Versioning System
 *
 * Manages storage schema versions and migrations.
 * Provides a unified entry point for validation, migration, and repair.
 *
 * @typedef {import('../types.js').StorageV2} StorageV2
 */

import { generateUUID } from '../utils/uuid.js';
import { validateSnoozedTabsV2, sanitizeSnoozedTabsV2 } from '../utils/validation.js';

// Current schema version
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Detects the schema version from raw storage data
 * @param {any} data - Raw storage data
 * @returns {number|null} - Version number (1, 2, ...) or null if empty/invalid
 */
export function detectSchemaVersion(data) {
  // Reject null, non-objects, and arrays
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  // If version field exists, use it
  if ('version' in data && typeof data.version === 'number') {
    return data.version;
  }

  // V1 Legacy: has tabCount or numeric timestamp keys
  if ('tabCount' in data) {
    return 1;
  }

  // Check for numeric timestamp keys (V1 pattern)
  const keys = Object.keys(data);
  const hasNumericKeys = keys.some(key => !isNaN(parseInt(key)) && String(parseInt(key)) === key);
  if (hasNumericKeys) {
    return 1;
  }

  // V2: has items and schedule
  if ('items' in data && 'schedule' in data) {
    return 2;
  }

  // Unknown structure
  return null;
}

/**
 * Migrates V1 legacy data to V2 normalized schema
 * @param {Object} v1Data - V1 legacy data
 * @returns {StorageV2} V2 data with version field
 */
function migrateV1toV2(v1Data) {
  const items = {};
  const schedule = {};

  for (const key of Object.keys(v1Data)) {
    if (key === 'tabCount') continue;

    const time = parseInt(key, 10);
    if (isNaN(time)) continue;

    const tabs = v1Data[key];
    if (!Array.isArray(tabs)) continue;

    if (!schedule[time]) schedule[time] = [];

    for (const tab of tabs) {
      // Generate unique ID (handle existing IDs from tab data)
      let id = tab.id || generateUUID();
      while (items[id]) {
        id = generateUUID();
      }

      // Ensure popTime field exists (required for validation)
      const entry = {
        ...tab,
        id,
        popTime: tab.popTime || time // Use timestamp key if popTime missing
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
export const SCHEMA_MIGRATIONS = {
  1: migrateV1toV2,
  // Future: 2: migrateV2toV3,
};

/**
 * Runs migrations sequentially from source version to target version
 * @param {Object} data - Data at source version
 * @param {number} sourceVersion - Starting version
 * @param {number} targetVersion - Target version
 * @returns {Promise<StorageV2>} Migrated data at target version
 */
export async function runMigrations(data, sourceVersion, targetVersion) {
  if (sourceVersion === targetVersion) {
    return data;
  }

  let currentData = data;
  let currentVersion = sourceVersion;

  // Run migrations sequentially
  while (currentVersion < targetVersion) {
    const migrationFn = SCHEMA_MIGRATIONS[currentVersion];

    if (!migrationFn) {
      throw new Error(`No migration found from version ${currentVersion} to ${currentVersion + 1}`);
    }

    currentData = migrationFn(currentData);
    currentVersion++;
  }

  return currentData;
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
 *
 * @returns {Promise<StorageV2>} Valid V2 data with version field
 */
export async function ensureValidStorage() {
  // Load all storage data
  const all = await chrome.storage.local.get(null);

  // Try V2 data first
  let data = all.snoooze_v2;
  let version = detectSchemaVersion(data);

  // Fall back to V1 legacy if V2 doesn't exist
  if (version === null && all.snoozedTabs) {
    data = all.snoozedTabs;
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
  if (!data.version) {
    data.version = CURRENT_SCHEMA_VERSION;
  }

  // Validate structure
  const validation = validateSnoozedTabsV2(data);

  if (!validation.valid) {
    // Sanitize invalid data
    const sanitized = sanitizeSnoozedTabsV2(data);
    return {
      version: CURRENT_SCHEMA_VERSION,
      ...sanitized
    };
  }

  return data;
}
