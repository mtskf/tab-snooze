/**
 * Validation utilities for snoozedTabs storage
 */

/**
 * Required fields for a valid tab entry
 */
const REQUIRED_TAB_FIELDS = ['url', 'creationTime', 'popTime'];

/**
 * Validates a single tab entry
 * @param {any} tab - Tab entry to validate
 * @returns {{ valid: boolean, errors: string[] }}
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
 * Validates the snoozedTabs data structure
 * @param {any} data - Data to validate
 * @returns {{ valid: boolean, errors: string[], repairable: boolean }}
 */
export function validateSnoozedTabs(data) {
  const errors = [];
  let repairable = true;

  // Check basic structure
  if (data === null || data === undefined) {
    return { valid: false, errors: ['Data is null or undefined'], repairable: false };
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Data is not an object'], repairable: false };
  }

  // Check tabCount (can be repaired if missing or wrong)
  if (!('tabCount' in data)) {
    errors.push('Missing tabCount key');
    // Repairable by recomputing
  } else if (typeof data.tabCount !== 'number' || data.tabCount < 0) {
    errors.push('tabCount is not a valid non-negative number');
    // Repairable by recomputing
  }

  // Validate timestamp keys and tab entries
  let actualTabCount = 0;
  let hasValidTabs = false;

  for (const key of Object.keys(data)) {
    if (key === 'tabCount') continue;

    // Check if key is a numeric timestamp
    const timestamp = parseInt(key, 10);
    if (isNaN(timestamp) || String(timestamp) !== key) {
      errors.push(`Invalid timestamp key: ${key}`);
      continue;
    }

    const entries = data[key];
    if (!Array.isArray(entries)) {
      errors.push(`Value for timestamp ${key} is not an array`);
      repairable = false; // Can't repair non-array values
      continue;
    }

    // Validate each tab entry
    for (let i = 0; i < entries.length; i++) {
      const result = validateTabEntry(entries[i]);
      if (result.valid) {
        actualTabCount++;
        hasValidTabs = true;
      } else {
        errors.push(`Invalid tab at ${key}[${i}]: ${result.errors.join(', ')}`);
        // Individual invalid entries can be dropped, so still repairable
      }
    }
  }

  // Data is valid if no critical errors or if errors are all repairable
  const hasCriticalErrors = errors.some(e =>
    e.includes('not an object') ||
    e.includes('not an array')
  );

  // Check tabCount consistency
  if (data.tabCount !== undefined && actualTabCount !== data.tabCount) {
    errors.push(`tabCount mismatch: expected ${actualTabCount}, got ${data.tabCount}`);
    // Mismatch is repairable
  }

  return {
    valid: errors.length === 0,
    errors,
    repairable: repairable && !hasCriticalErrors
  };
}

/**
 * Sanitizes snoozedTabs data by fixing minor issues
 * - Recomputes tabCount if incorrect
 * - Drops invalid tab entries
 * - Removes invalid timestamp keys
 * @param {any} data - Data to sanitize
 * @returns {object} Sanitized copy of the data
 */
export function sanitizeSnoozedTabs(data) {
  // If completely invalid, return empty state
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { tabCount: 0 };
  }

  const sanitized = {};
  let tabCount = 0;

  for (const key of Object.keys(data)) {
    if (key === 'tabCount') continue;

    // Skip non-numeric keys
    const timestamp = parseInt(key, 10);
    if (isNaN(timestamp) || String(timestamp) !== key) {
      continue;
    }

    const entries = data[key];
    if (!Array.isArray(entries)) {
      continue;
    }

    // Filter to only valid entries
    const validEntries = entries.filter(entry => {
      const result = validateTabEntry(entry);
      return result.valid;
    });

    if (validEntries.length > 0) {
      sanitized[key] = validEntries;
      tabCount += validEntries.length;
    }
  }

  sanitized.tabCount = tabCount;
  return sanitized;
}

/**
 * Validates the V2 storage structure
 * @param {any} v2Data - Data to validate { items: {}, schedule: {} }
 * @returns {{ valid: boolean, errors: string[] }}
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
