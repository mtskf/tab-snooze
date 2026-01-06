import type { SnoozedItemV2, ValidationResult } from '../types';
import { RESTRICTED_PROTOCOLS } from './constants';

/**
 * Validates if a URL is restorable (valid format, not restricted protocol)
 * Used by both snooze logic and schema migration
 */
export function isRestorableUrl(url: unknown): url is string {
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

/**
 * Required fields for a valid tab entry
 */
const REQUIRED_TAB_FIELDS = ['url', 'creationTime', 'popTime'] as const;

/**
 * Validates a single tab entry for structural correctness.
 *
 * Note: This function validates data structure only, NOT URL restorability.
 * URL restorability (empty URLs, restricted protocols) is checked at:
 * - Snooze time: snoozeLogic.ts snooze()
 * - V1->V2 migration: schemaVersioning.ts migrateV1ToV2()
 *
 * If invalid URLs in V2 data become an issue (e.g., from direct V2 imports),
 * consider adding isRestorableUrl() check here or in sanitizeSnoozedTabsV2().
 */
export function validateTabEntry(tab: unknown): ValidationResult {
  const errors: string[] = [];

  if (!tab || typeof tab !== 'object') {
    return { valid: false, errors: ['Tab entry is not an object'] };
  }

  const tabObj = tab as Record<string, unknown>;

  for (const field of REQUIRED_TAB_FIELDS) {
    if (!(field in tabObj)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (tabObj.url && typeof tabObj.url !== 'string') {
    errors.push('url must be a string');
  }

  if (tabObj.creationTime !== undefined && typeof tabObj.creationTime !== 'number') {
    errors.push('creationTime must be a number');
  }

  if (tabObj.popTime !== undefined && typeof tabObj.popTime !== 'number') {
    errors.push('popTime must be a number');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates the V2 storage structure
 */
export function validateSnoozedTabsV2(v2Data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!v2Data || typeof v2Data !== 'object') {
    return { valid: false, errors: ['V2 Data is not an object'] };
  }

  const data = v2Data as Record<string, unknown>;

  if (!data.items || typeof data.items !== 'object') {
    errors.push('Missing items object');
  }
  if (!data.schedule || typeof data.schedule !== 'object') {
    errors.push('Missing schedule object');
  }

  if (errors.length > 0) return { valid: false, errors };

  const items = data.items as Record<string, unknown>;
  const schedule = data.schedule as Record<string, unknown>;

  // Validate Items
  for (const id in items) {
    if (!items[id] || typeof items[id] !== 'object') {
      errors.push(`Invalid item at ${id}`);
      continue;
    }
    const entryResult = validateTabEntry(items[id]);
    if (!entryResult.valid) {
      errors.push(`Invalid item ${id}: ${entryResult.errors.join(', ')}`);
    }
    const item = items[id] as Record<string, unknown>;
    if (item.id !== id) {
      errors.push(`ID Validation Mismatch: key ${id} vs obj.id ${item.id}`);
    }
  }

  // Validate Schedule
  for (const time in schedule) {
    const ids = schedule[time];
    if (!Array.isArray(ids)) {
      errors.push(`Schedule at ${time} is not an array`);
      continue;
    }
    ids.forEach(id => {
      if (!items[id]) {
        errors.push(`Schedule references missing item ID: ${id} at time ${time}`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

interface SanitizedV2Data {
  items: Record<string, SnoozedItemV2>;
  schedule: Record<string, string[]>;
}

/**
 * Sanitizes V2 storage data by removing invalid items and orphaned schedule entries
 */
export function sanitizeSnoozedTabsV2(v2Data: unknown): SanitizedV2Data {
  if (!v2Data || typeof v2Data !== 'object') {
    return { items: {}, schedule: {} };
  }

  const data = v2Data as Record<string, unknown>;
  const items: Record<string, SnoozedItemV2> = {};
  const schedule: Record<string, string[]> = {};

  // Copy valid items only
  if (data.items && typeof data.items === 'object') {
    const inputItems = data.items as Record<string, unknown>;
    for (const id in inputItems) {
      const item = inputItems[id];
      if (!item || typeof item !== 'object') continue;

      const entryResult = validateTabEntry(item);
      const itemObj = item as Record<string, unknown>;
      if (entryResult.valid && itemObj.id === id) {
        items[id] = item as SnoozedItemV2;
      }
    }
  }

  // Rebuild schedule with only valid item references
  if (data.schedule && typeof data.schedule === 'object') {
    const inputSchedule = data.schedule as Record<string, unknown>;
    for (const time in inputSchedule) {
      const ids = inputSchedule[time];
      if (!Array.isArray(ids)) continue;

      const validIds = ids.filter(id => items[id]);
      if (validIds.length > 0) {
        schedule[time] = validIds;
      }
    }
  }

  return { items, schedule };
}
