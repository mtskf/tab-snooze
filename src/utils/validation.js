/**
 * Validation utilities for snoozedTabs storage
 * @typedef {import('../types').SnoozedItemV2} SnoozedItemV2
 * @typedef {import('../types').StorageV2} StorageV2
 * @typedef {import('../types').ValidationResult} ValidationResult
 */

/**
 * Required fields for a valid tab entry
 */
const REQUIRED_TAB_FIELDS = ['url', 'creationTime', 'popTime'];

/**
 * Validates a single tab entry
 * @param {any} tab - Tab entry to validate
 * @returns {ValidationResult} Validation result with valid flag and errors array
 */
export function validateTabEntry(tab) {
  const errors = [];

  if (!tab || typeof tab !== 'object') {
    return { valid: false, errors: ['Tab entry is not an object'] };
  }

  for (const field of REQUIRED_TAB_FIELDS) {
    if (!(field in tab)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (tab.url && typeof tab.url !== 'string') {
    errors.push('url must be a string');
  }

  if (tab.creationTime !== undefined && typeof tab.creationTime !== 'number') {
    errors.push('creationTime must be a number');
  }

  if (tab.popTime !== undefined && typeof tab.popTime !== 'number') {
    errors.push('popTime must be a number');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates the V2 storage structure
 * @param {any} v2Data - Data to validate
 * @returns {ValidationResult} Validation result with valid flag and errors array
 */
export function validateSnoozedTabsV2(v2Data) {
  const errors = [];
  if (!v2Data || typeof v2Data !== 'object') {
     return { valid: false, errors: ['V2 Data is not an object'] };
  }
  if (!v2Data.items || typeof v2Data.items !== 'object') {
      errors.push('Missing items object');
  }
  if (!v2Data.schedule || typeof v2Data.schedule !== 'object') {
      errors.push('Missing schedule object');
  }

  if (errors.length > 0) return { valid: false, errors };

  // Validate Items
  for (const id in v2Data.items) {
      if (!v2Data.items[id] || typeof v2Data.items[id] !== 'object') {
          errors.push(`Invalid item at ${id}`);
          continue;
      }
      const entryResult = validateTabEntry(v2Data.items[id]);
      if (!entryResult.valid) {
          errors.push(`Invalid item ${id}: ${entryResult.errors.join(', ')}`);
      }
      if (v2Data.items[id].id !== id) {
          errors.push(`ID Validation Mismatch: key ${id} vs obj.id ${v2Data.items[id].id}`);
      }
  }

  // Validate Schedule
  for (const time in v2Data.schedule) {
      const ids = v2Data.schedule[time];
      if (!Array.isArray(ids)) {
          errors.push(`Schedule at ${time} is not an array`);
          continue;
      }
      ids.forEach(id => {
          if (!v2Data.items[id]) {
              errors.push(`Schedule references missing item ID: ${id} at time ${time}`);
          }
      });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitizes V2 storage data by removing invalid items and orphaned schedule entries
 * @param {any} v2Data - The V2 data to sanitize
 * @returns {{ items: Record<string, SnoozedItemV2>, schedule: Record<number, string[]> }} Sanitized V2 data (without version field)
 */
export function sanitizeSnoozedTabsV2(v2Data) {
  if (!v2Data || typeof v2Data !== 'object') {
    return { items: {}, schedule: {} };
  }

  const items = {};
  const schedule = {};

  // Copy valid items only
  if (v2Data.items && typeof v2Data.items === 'object') {
    for (const id in v2Data.items) {
      const item = v2Data.items[id];
      if (!item || typeof item !== 'object') continue;

      const entryResult = validateTabEntry(item);
      if (entryResult.valid && item.id === id) {
        items[id] = item;
      }
    }
  }

  // Rebuild schedule with only valid item references
  if (v2Data.schedule && typeof v2Data.schedule === 'object') {
    for (const time in v2Data.schedule) {
      const ids = v2Data.schedule[time];
      if (!Array.isArray(ids)) continue;

      const validIds = ids.filter(id => items[id]);
      if (validIds.length > 0) {
        schedule[time] = validIds;
      }
    }
  }

  return { items, schedule };
}
