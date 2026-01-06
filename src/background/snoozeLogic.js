/**
 * @typedef {import('../types').SnoozedItemV2} SnoozedItemV2
 * @typedef {import('../types').StorageV2} StorageV2
 * @typedef {import('../types').Settings} Settings
 * @typedef {import('../types').RecoveryResult} RecoveryResult
 * @typedef {import('../types').ChromeTab} ChromeTab
 */

import { generateUUID } from '../utils/uuid.js';
import { storage, tabs, windows, notifications } from '../utils/ChromeApi.js';

import { validateSnoozedTabsV2, sanitizeSnoozedTabsV2 } from '../utils/validation.js';
import { DEFAULT_SETTINGS, RESTRICTED_PROTOCOLS, BACKUP_COUNT, BACKUP_DEBOUNCE_MS, BACKUP_PREFIX, WARNING_THRESHOLD, CLEAR_THRESHOLD, THROTTLE_MS } from '../utils/constants.js';
import { getSettingsWithDefaults } from '../utils/settingsHelper.js';
import { ensureValidStorage } from './schemaVersioning.js';



// Backup configuration
let backupTimer = null;

// Storage size warning configuration

/**
 * Check storage size and warn user if approaching limit.
 */
export async function checkStorageSize() {
  try {
    const bytesUsed = await storage.getBytesInUse(null);
    const storageData = await storage.getLocal(['sizeWarningActive', 'lastSizeWarningAt']);
    const wasActive = storageData.sizeWarningActive || false;

    // If API is unsupported (returns 0), clear any existing warning and skip check
    if (bytesUsed === 0) {
      if (wasActive) {
        await storage.setLocal({ sizeWarningActive: false });
      }
      return;
    }

    const lastWarningAt = storageData.lastSizeWarningAt;
    const now = Date.now();

    let shouldBeActive = wasActive;

    if (bytesUsed > WARNING_THRESHOLD) {
      shouldBeActive = true;
    } else if (bytesUsed < CLEAR_THRESHOLD) {
      shouldBeActive = false;
    }

    if (shouldBeActive !== wasActive) {
      await storage.setLocal({ sizeWarningActive: shouldBeActive });
    }

    if (shouldBeActive && !wasActive) {
      const shouldNotify = !lastWarningAt || (now - lastWarningAt) > THROTTLE_MS;
      if (shouldNotify) {
        await notifications.create('storage-warning', {
          type: 'basic',
          iconUrl: 'assets/icon128.png',
          title: 'Snooooze storage is almost full',
          message: 'Open Snoozed list to delete or restore old tabs.',
          priority: 1
        });
        await storage.setLocal({ lastSizeWarningAt: now });
      }
    }
  } catch (e) {
    console.warn('Storage size check failed:', e);
  }
}

// --- V2 Storage Accessors (Internal) ---

/**
 * Retrieves V2 storage with defensive structure validation.
 * Ensures items and schedule are always valid plain objects (not arrays),
 * preventing crashes when storage is corrupted or partially missing.
 * Preserves version field if present.
 * @returns {Promise<StorageV2>} V2 storage data
 */
async function getStorageV2() {
    const res = await storage.getLocal("snoooze_v2");
    const data = res.snoooze_v2;

    // Helper to validate plain object (not null, not array)
    const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

    // Handle completely missing or invalid data
    if (!isPlainObject(data)) {
        return { version: 2, items: {}, schedule: {} };
    }

    // Ensure items and schedule are valid plain objects
    return {
        version: data.version || 2, // Preserve version if exists, default to 2
        items: isPlainObject(data.items) ? data.items : {},
        schedule: isPlainObject(data.schedule) ? data.schedule : {}
    };
}

/**
 * Saves V2 storage and schedules backup rotation
 * @param {StorageV2} v2Data - V2 storage data to save
 * @returns {Promise<void>}
 */
async function saveStorageV2(v2Data) {
    await storage.setLocal({ snoooze_v2: v2Data });
    scheduleBackupRotation(v2Data);
}

/**
 * Write Adapter (V1 -> V2)
 * Used if legacy code calls setSnoozedTabs. Converts structure and saves V2.
 * Overwrites any existing V2 data with the provided data.
 * @param {Object} legacyData - V1 legacy format data or V2 data to import
 * @returns {Promise<void>}
 * @throws {Error} If data is from future schema version (cannot downgrade)
 */
export async function setSnoozedTabs(legacyData) {
    const { detectSchemaVersion, runMigrations, CURRENT_SCHEMA_VERSION } = await import('./schemaVersioning.js');

    // Detect source version and migrate to current version
    const sourceVersion = detectSchemaVersion(legacyData);

    if (sourceVersion === null) {
        // Empty/invalid data - save empty V2
        await storage.setLocal({
            snoooze_v2: { version: CURRENT_SCHEMA_VERSION, items: {}, schedule: {} }
        });
        return;
    }

    // Reject future schema versions (cannot downgrade)
    if (sourceVersion > CURRENT_SCHEMA_VERSION) {
        throw new Error(`Cannot import data from future schema version ${sourceVersion}. Current version is ${CURRENT_SCHEMA_VERSION}.`);
    }

    // Migrate from source version to current version
    let v2Data = await runMigrations(legacyData, sourceVersion, CURRENT_SCHEMA_VERSION);

    // Ensure version field is always present (even if source == target)
    if (!v2Data.version) {
        v2Data = { ...v2Data, version: CURRENT_SCHEMA_VERSION };
    }

    await storage.setLocal({ snoooze_v2: v2Data });
}

// --- Backup & Rotation ---

function scheduleBackupRotation(data) {
  if (backupTimer) {
    clearTimeout(backupTimer);
  }
  backupTimer = setTimeout(async () => {
    backupTimer = null;
    await rotateBackups(data);
    await checkStorageSize();
  }, BACKUP_DEBOUNCE_MS);
}

async function rotateBackups(data) {
  // Use V2 validation
  const validation = validateSnoozedTabsV2(data);

  if (!validation.valid) {
      console.warn('Backup skipped due to invalid V2 data', validation.errors);
      return;
  }

  const dataToBackup = data;

  try {
    // Get all backup keys
    const allStorage = await storage.getLocal(null);
    const backupKeys = Object.keys(allStorage)
      .filter(k => k.startsWith(BACKUP_PREFIX))
      .sort((a, b) => {
        const tsA = parseInt(a.replace(BACKUP_PREFIX, ''), 10);
        const tsB = parseInt(b.replace(BACKUP_PREFIX, ''), 10);
        return tsB - tsA; // Newest first
      });

    // Create new backup
    const newBackupKey = `${BACKUP_PREFIX}${Date.now()}`;
    await storage.setLocal({ [newBackupKey]: dataToBackup });

    // Delete old backups beyond BACKUP_COUNT
    const keysToDelete = backupKeys.slice(BACKUP_COUNT - 1); // -1 because we just added one
    if (keysToDelete.length > 0) {
      await storage.removeLocal(keysToDelete);
    }
  } catch (e) {
    // Backup failed, but don't crash the extension
    console.warn('Backup rotation failed:', e);
  }
}

/**
 * Gets validated snoozed tabs in V2 format, sanitizing if validation fails
 * @returns {Promise<StorageV2>} V2 format { version: 2, items: {...}, schedule: {...} }
 */
export async function getSnoozedTabsV2() {
    const v2Data = await getStorageV2();
    const validation = validateSnoozedTabsV2(v2Data);

    if (!validation.valid) {
        console.warn('V2 validation errors during read, sanitizing and persisting:', validation.errors);
        const sanitized = sanitizeSnoozedTabsV2(v2Data);
        const result = { ...sanitized, version: 2 };
        await saveStorageV2(result);
        return result;
    }

    // Ensure version field is present
    return {
        ...v2Data,
        version: v2Data.version || 2
    };
}

/**
 * Gets export data (validated V2 format)
 * @returns {Promise<StorageV2>} V2 format ready for export
 */
export async function getExportData() {
    return await getSnoozedTabsV2();
}

/**
 * Imports tabs from raw data (V1 or V2 format)
 * Migrates V1 to V2 if needed, validates, and merges with existing data.
 * ID collisions are resolved by generating new UUIDs.
 * @param {Object} rawData - Raw import data (V1 or V2 format)
 * @returns {Promise<{success: boolean, addedCount?: number, error?: string}>}
 */
export async function importTabs(rawData) {
    const { detectSchemaVersion, runMigrations, CURRENT_SCHEMA_VERSION } = await import('./schemaVersioning.js');

    try {
        // Validate input is an object
        if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
            return { success: false, error: 'Invalid data structure' };
        }

        // Detect schema version
        const sourceVersion = detectSchemaVersion(rawData);

        if (sourceVersion === null) {
            // Empty or invalid data
            return { success: true, addedCount: 0 };
        }

        // Reject future schema versions
        if (sourceVersion > CURRENT_SCHEMA_VERSION) {
            return {
                success: false,
                error: `Cannot import data from future schema version ${sourceVersion}`
            };
        }

        // Migrate to V2 if needed
        let importV2Data = sourceVersion === CURRENT_SCHEMA_VERSION
            ? rawData
            : await runMigrations(rawData, sourceVersion, CURRENT_SCHEMA_VERSION);

        // Ensure version field
        importV2Data = { ...importV2Data, version: CURRENT_SCHEMA_VERSION };

        // Validate and sanitize import data
        const validation = validateSnoozedTabsV2(importV2Data);
        if (!validation.valid) {
            console.warn('Import data validation errors, sanitizing:', validation.errors);
            importV2Data = { ...sanitizeSnoozedTabsV2(importV2Data), version: CURRENT_SCHEMA_VERSION };
        }

        // Get existing data
        const existingData = await getStorageV2();

        // Count items to add
        const itemsToImport = Object.keys(importV2Data.items || {}).length;
        if (itemsToImport === 0) {
            return { success: true, addedCount: 0 };
        }

        // Merge with collision handling
        const mergedItems = { ...existingData.items };
        const mergedSchedule = { ...existingData.schedule };

        for (const [originalId, item] of Object.entries(importV2Data.items)) {
            let finalId = originalId;

            // Handle ID collision
            if (mergedItems[originalId]) {
                finalId = generateUUID();
            }

            // Add item with potentially new ID
            mergedItems[finalId] = { ...item, id: finalId };

            // Add to schedule
            const popTime = item.popTime;
            if (!mergedSchedule[popTime]) {
                mergedSchedule[popTime] = [];
            }
            mergedSchedule[popTime].push(finalId);
        }

        // Save merged data
        const mergedData = {
            version: CURRENT_SCHEMA_VERSION,
            items: mergedItems,
            schedule: mergedSchedule
        };
        await saveStorageV2(mergedData);

        return { success: true, addedCount: itemsToImport };
    } catch (error) {
        console.error('Import failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Recovers snoozed tabs from backup storage
 * @returns {Promise<{recovered: boolean, tabCount: number, sanitized?: boolean}>} Recovery result
 */
export async function recoverFromBackup() {
    // V2 Recovery logic: Try to find fully valid backup first, then fall back to sanitized
    const allStorage = await storage.getLocal(null);
    const backupKeys = Object.keys(allStorage)
        .filter(k => k.startsWith(BACKUP_PREFIX))
        .sort((a, b) => parseInt(b.replace(BACKUP_PREFIX, '')) - parseInt(a.replace(BACKUP_PREFIX, '')));

    // First pass: Search for fully valid backup
    for (const key of backupKeys) {
        const backupData = allStorage[key];
        if (backupData && backupData.items && backupData.schedule) {
            const validation = validateSnoozedTabsV2(backupData);
            if (validation.valid) {
                await storage.setLocal({ snoooze_v2: backupData });
                return { recovered: true, tabCount: Object.keys(backupData.items).length };
            }
        }
    }

    // Second pass: No valid backup found, try finding the BEST sanitized backup (most items)
    let bestCandidate = null;
    let maxItems = -1;

    for (const key of backupKeys) {
        const backupData = allStorage[key];
        if (backupData && backupData.items && backupData.schedule) {
            const sanitized = sanitizeSnoozedTabsV2(backupData);
            const itemCount = Object.keys(sanitized.items).length;

            // Prefer backup with more items. If equal, prefer newer (already sorted desc)
            if (itemCount > maxItems) {
                maxItems = itemCount;
                bestCandidate = sanitized;
            }
        }
    }

    if (bestCandidate && maxItems > 0) {
        console.warn('No fully valid backup found. Recovered best available sanitized backup.');
        // Add version field after sanitization (force v2, override any existing version)
        await storage.setLocal({ snoooze_v2: { ...bestCandidate, version: 2 } });
        return { recovered: true, tabCount: maxItems, sanitized: true };
    }

    // Reset
    const empty = { items: {}, schedule: {} };
    await storage.setLocal({ snoooze_v2: empty });
    return { recovered: false, tabCount: 0 };
}

// Migration logic moved to schemaVersioning.js for centralized version management

/**
 * Gets extension settings, merged with defaults
 * @returns {Promise<Settings>} Settings object with defaults applied
 */
export async function getSettings() {
  return getSettingsWithDefaults();
}

/**
 * Updates extension settings
 * @param {Partial<Settings>} val - Settings to update
 * @returns {Promise<void>}
 */
export async function setSettings(val) {
  await storage.setLocal({ settings: val });
}

// --- Initialization ---

export async function initStorage() {
  const all = await storage.getLocal(null);

  // Check if V2 data exists but is invalid - trigger recovery if needed
  const validation = validateSnoozedTabsV2(all.snoooze_v2);
  if (all.snoooze_v2 && !validation.valid) {
      const recovery = await recoverFromBackup();
      await storage.setSession({
          pendingRecoveryNotification: recovery.tabCount
      });
  }

  // Use unified entry point for storage validation, migration, and repair
  const validData = await ensureValidStorage();

  // Save the validated data with version field
  await storage.setLocal({ snoooze_v2: validData });

  // Check if we migrated from legacy (backup if needed)
  if (all.snoozedTabs && !all.snoooze_v2) {
      console.log('Detected legacy data - creating backup');
      await storage.setLocal({ snoozedTabs_legacy_backup: all.snoozedTabs });
      await storage.removeLocal('snoozedTabs');
  }

  // Initialize settings if missing from storage
  const storedSettings = await storage.getLocal('settings');
  if (!storedSettings.settings) {
    await setSettings({ ...DEFAULT_SETTINGS });
  }

  await checkStorageSize();
}


// --- Main Logic (Refactored to V2) ---

let storageLock = Promise.resolve();

// Inner helper: modifies object reference
function removeSnoozedTabV2(tabId, v2Data) {
    const item = v2Data.items[tabId];
    if (!item) return;

    const popTime = item.popTime;

    // Remove from Items
    delete v2Data.items[tabId];

    // Remove from Schedule
    if (v2Data.schedule[popTime]) {
        v2Data.schedule[popTime] = v2Data.schedule[popTime].filter(id => id !== tabId);
        if (v2Data.schedule[popTime].length === 0) {
            delete v2Data.schedule[popTime];
        }
    }
}

async function addSnoozedTab(tab, popTime, groupId = null) {
  const task = storageLock.then(async () => {
    const v2Data = await getStorageV2();

    const id = generateUUID();
    const entry = {
      id: id,
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl || tab.favicon,
      creationTime: new Date().getTime(),
      popTime: popTime.getTime(),
      groupId: groupId,
      index: tab.index,
    };

    v2Data.items[id] = entry;

    const timeKey = popTime.getTime();
    if (!v2Data.schedule[timeKey]) {
        v2Data.schedule[timeKey] = [];
    }
    v2Data.schedule[timeKey].push(id);

    await saveStorageV2(v2Data);
  });

  storageLock = task.catch((e) => {});
  return task;
}


export async function snooze(tab, popTime, groupId = null) {
  const popTimeObj = new Date(popTime);

  try {
      const url = new URL(tab.url);
      if (RESTRICTED_PROTOCOLS.some(p => url.protocol === p)) {
          console.warn(`Skipping restricted URL: ${tab.url}`);
          return;
      }
  } catch (e) {
      console.warn("Invalid URL for snooze:", tab.url);
      return;
  }

  try {
    await addSnoozedTab(tab, popTimeObj, groupId);
  } catch (e) {
    console.error("Failed to save snoozed tab:", e);
    throw e;
  }

  try {
    await tabs.remove(tab.id);
  } catch (e) {
    // Tab likely closed
  }
}

// Restoration Lock
let isRestoring = false;

// Retry configuration
const RETRY_DELAY_MS = 200;
const MAX_RETRIES = 3;
const RESCHEDULE_DELAY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Delays execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes an async function with retry logic
 * @param {Function} fn - Async function to execute
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delayMs - Delay between retries in milliseconds
 * @returns {Promise<{success: boolean, result?: any, error?: Error}>}
 */
async function withRetry(fn, maxRetries = MAX_RETRIES, delayMs = RETRY_DELAY_MS) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { success: true, result };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await delay(delayMs);
      }
    }
  }
  return { success: false, error: lastError };
}

export async function popCheck() {
  if (isRestoring || !navigator.onLine) {
    return 0;
  }

  const v2Data = await getStorageV2();
  const now = Date.now();

  const tabsToPop = [];
  // We can't modify v2Data structure while iterating easily if we are just reading.
  // We identify what to pop first.

  for (const timeStr of Object.keys(v2Data.schedule).sort()) {
      const time = parseInt(timeStr);
      if (time < now) {
          const ids = v2Data.schedule[timeStr];
          ids.forEach(id => {
              if (v2Data.items[id]) {
                  tabsToPop.push(v2Data.items[id]);
              }
          });
      }
  }

  if (tabsToPop.length > 0) {
    try {
      isRestoring = true;
      await restoreTabs(tabsToPop);
    } finally {
      isRestoring = false;
    }
  }

  return { count: tabsToPop.length };
}


async function restoreTabs(tabsToRestore) {
  const groups = {};
  const ungrouped = [];

  tabsToRestore.forEach((tab) => {
    if (tab.groupId) {
      if (!groups[tab.groupId]) groups[tab.groupId] = [];
      groups[tab.groupId].push(tab);
    } else {
      ungrouped.push(tab);
    }
  });

  const restoredTabs = [];
  const failedTabs = [];

  // Process groups with retry
  for (const groupId in groups) {
    const groupTabs = groups[groupId];
    if (groupTabs.length > 0) {
      groupTabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const urls = groupTabs.map((t) => t.url);

      const { success, result: createdWindow } = await withRetry(async () => {
        let win = await windows.create({ url: urls, focused: true });
        if (win && !win.tabs) {
          try {
            win = await windows.get(win.id, { populate: true });
          } catch (e) { /* ignore */ }
        }
        // Validate all tabs were created
        if (!win || !win.tabs || win.tabs.length !== urls.length) {
          // Cleanup partial window before retrying
          if (win && win.id) {
            try {
              await windows.remove(win.id);
            } catch (e) {
              // Ignore cleanup errors
            }
          }
          throw new Error(`Partial restore: expected ${urls.length} tabs, got ${win?.tabs?.length || 0}`);
        }
        return win;
      });

      if (success) {
        restoredTabs.push(...groupTabs);
      } else {
        console.warn(`Failed to restore group ${groupId} after ${MAX_RETRIES} retries`);
        failedTabs.push(...groupTabs);
      }
    }
  }

  // Process ungrouped tabs with retry
  if (ungrouped.length > 0) {
    let targetWindow;
    try {
      targetWindow = await windows.getLastFocused();
    } catch (e) {
      try {
        targetWindow = await windows.create({});
      } catch (e2) {
        targetWindow = null;
      }
    }

    if (targetWindow) {
      for (const tab of ungrouped) {
        const { success } = await withRetry(async () => {
          await tabs.create({
            windowId: targetWindow.id,
            url: tab.url,
            active: false,
          });
        });

        if (success) {
          restoredTabs.push(tab);
        } else {
          failedTabs.push(tab);
        }
      }
    } else {
      // No window available, all ungrouped tabs fail
      failedTabs.push(...ungrouped);
    }
  }

  // Handle failed tabs: reschedule to future time and notify user
  if (failedTabs.length > 0) {
    await handleFailedTabs(failedTabs);
  }

  // Cleanup storage for restored tabs only
  const cleanupTask = storageLock.then(async () => {
    const v2Data = await getStorageV2();

    restoredTabs.forEach(tab => {
      removeSnoozedTabV2(tab.id, v2Data);
    });

    await saveStorageV2(v2Data);
  });

  storageLock = cleanupTask.catch(() => {});
  await cleanupTask.catch(err => {
    console.error('Failed to cleanup storage after restore:', err);
  });
  await storageLock;
}

/**
 * Handles failed tabs by rescheduling them and notifying the user
 * @param {SnoozedItemV2[]} failedTabs - Array of tabs that failed to restore
 */
async function handleFailedTabs(failedTabs) {
  const newPopTime = Date.now() + RESCHEDULE_DELAY_MS;

  // Reschedule failed tabs to future time
  const rescheduleTask = storageLock.then(async () => {
    const v2Data = await getStorageV2();

    for (const tab of failedTabs) {
      const oldPopTime = tab.popTime;

      // Remove from old schedule
      if (v2Data.schedule[oldPopTime]) {
        v2Data.schedule[oldPopTime] = v2Data.schedule[oldPopTime].filter(id => id !== tab.id);
        if (v2Data.schedule[oldPopTime].length === 0) {
          delete v2Data.schedule[oldPopTime];
        }
      }

      // Update item's popTime
      if (v2Data.items[tab.id]) {
        v2Data.items[tab.id].popTime = newPopTime;
      }

      // Add to new schedule
      if (!v2Data.schedule[newPopTime]) {
        v2Data.schedule[newPopTime] = [];
      }
      v2Data.schedule[newPopTime].push(tab.id);
    }

    await saveStorageV2(v2Data);
  });

  storageLock = rescheduleTask.catch(() => {});
  await rescheduleTask.catch(err => {
    console.error('Failed to reschedule failed tabs:', err);
  });

  // Store failed tabs info in session storage for Dialog display
  await storage.setSession({
    failedRestoreTabs: failedTabs.map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      favicon: tab.favicon
    }))
  });

  // Show notification to user
  const tabCount = failedTabs.length;
  const tabWord = tabCount === 1 ? 'tab' : 'tabs';
  await notifications.create('restore-failed', {
    type: 'basic',
    iconUrl: 'assets/icon128.png',
    title: `Failed to restore ${tabCount} ${tabWord}`,
    message: `Click to view details. ${tabWord.charAt(0).toUpperCase() + tabWord.slice(1)} will be retried in 5 minutes.`,
    priority: 2
  });
}


async function createTabsInWindow(tabs, w) {
  const promises = tabs.map((tab) => createTab(tab, w));
  return Promise.all(promises);
}

async function createTab(tab, w) {
  try {
    await tabs.create({
      windowId: w.id,
      url: tab.url,
      active: false,
    });
    return { success: true };
  } catch (e) {
    console.error("Tab creation failed:", tab.url, e);
    return { success: false };
  }
}

// Helpers for manual restore
function getTabsByGroupIdV2(v2Data, groupId) {
    // Scan items (O(N) but safer than maintaining another index for now)
    return Object.values(v2Data.items).filter(item => item.groupId === groupId);
}

export async function restoreWindowGroup(groupId) {
  const v2Data = await getStorageV2();

  const groupTabs = getTabsByGroupIdV2(v2Data, groupId);
  if (groupTabs.length === 0) return;

  groupTabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const urls = groupTabs.map((t) => t.url);

  let createdWindow = await windows.create({ url: urls, focused: true });

  if (createdWindow && !createdWindow.tabs) {
       try {
           createdWindow = await windows.get(createdWindow.id, { populate: true });
       } catch (e) {}
  }

  if (createdWindow && createdWindow.tabs && createdWindow.tabs.length === urls.length) {
      await removeWindowGroup(groupId);
  } else {
      console.warn(`Partial restore detected for manual group restore ${groupId}.`);
  }
}


export async function removeSnoozedTabWrapper(tab) {
  storageLock = storageLock
    .then(async () => {
      const v2Data = await getStorageV2();
      removeSnoozedTabV2(tab.id, v2Data);
      await saveStorageV2(v2Data);
    })
    .catch((err) => {
      console.warn("Error removing snoozed tab:", err);
    });
  return storageLock;
}

export async function removeWindowGroup(groupId) {
  storageLock = storageLock
    .then(async () => {
      const v2Data = await getStorageV2();
      // Find IDs in group
      const itemIdsToRemove = [];
      for(const id in v2Data.items) {
          if (v2Data.items[id].groupId === groupId) {
              itemIdsToRemove.push(id);
          }
      }
      itemIdsToRemove.forEach(id => removeSnoozedTabV2(id, v2Data));

      await saveStorageV2(v2Data);
    })
    .catch((err) => {
      console.warn("Error removing window group:", err);
    });
  return storageLock;
}
