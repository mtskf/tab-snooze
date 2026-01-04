/**
 * @typedef {import('../types.js').SnoozedItemV2} SnoozedItemV2
 * @typedef {import('../types.js').StorageV2} StorageV2
 * @typedef {import('../types.js').Settings} Settings
 * @typedef {import('../types.js').RecoveryResult} RecoveryResult
 * @typedef {import('../types.js').ChromeTab} ChromeTab
 */

import { generateUUID } from '../utils/uuid.js';
import { storage, tabs, windows, notifications } from '../utils/ChromeApi.js';

import { validateSnoozedTabs, sanitizeSnoozedTabs, validateSnoozedTabsV2, sanitizeSnoozedTabsV2 } from '../utils/validation.js';
import { DEFAULT_SETTINGS, RESTRICTED_PROTOCOLS, BACKUP_COUNT, BACKUP_DEBOUNCE_MS, BACKUP_PREFIX, STORAGE_LIMIT, WARNING_THRESHOLD, CLEAR_THRESHOLD, THROTTLE_MS } from '../utils/constants.js';
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

// --- Adapters (Public API for UI/Legacy) ---

/**
 * Adapts V2 structure to V1 format (Read Adapter)
 * @param {StorageV2} v2Data - V2 storage data
 * @returns {Object} V1 legacy format { tabCount: number, [timestamp]: SnoozedItemV2[] }
 */
function adapterV1(v2Data) {
    if (!v2Data || !v2Data.items || !v2Data.schedule) return { tabCount: 0 };

    const legacy = { tabCount: 0 };

    for (const time in v2Data.schedule) {
        const ids = v2Data.schedule[time];
        // Map IDs to Items, verify existence
        const tabs = ids.map(id => v2Data.items[id]).filter(Boolean);
        if (tabs.length > 0) {
            legacy[time] = tabs;
            legacy.tabCount += tabs.length;
        }
    }
    return legacy;
}

/**
 * Gets all snoozed tabs in V1 legacy format (for backwards compatibility)
 * @returns {Promise<Object>} V1 legacy format { tabCount: number, [timestamp]: SnoozedItemV2[] }
 */
export async function getSnoozedTabs() {
  const v2Data = await getStorageV2();
  return adapterV1(v2Data);
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
 * Gets validated snoozed tabs, sanitizing if validation fails
 * @returns {Promise<Object>} V1 legacy format { tabCount: number, [timestamp]: SnoozedItemV2[] }
 */
export async function getValidatedSnoozedTabs() {
    const v2Data = await getStorageV2();
    const validation = validateSnoozedTabsV2(v2Data);

    if (!validation.valid) {
        console.warn('V2 validation errors during read, sanitizing and persisting:', validation.errors);
        const sanitized = sanitizeSnoozedTabsV2(v2Data);
        // Add version field after sanitization (force v2, override any existing version)
        await saveStorageV2({ ...sanitized, version: 2 });
        return adapterV1(sanitized);
    }

    return adapterV1(v2Data);
}

/**
 * Recovers snoozed tabs from backup storage
 * @returns {Promise<RecoveryResult>} Recovery result with data, success status, and tab count
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
                return { data: adapterV1(backupData), recovered: true, tabCount: Object.keys(backupData.items).length };
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
        return { data: adapterV1(bestCandidate), recovered: true, tabCount: maxItems, sanitized: true };
    }

    // Reset
    const empty = { items: {}, schedule: {} };
    await storage.setLocal({ snoooze_v2: empty });
    return { data: { tabCount: 0 }, recovered: false, tabCount: 0 };
}

// Migration logic moved to schemaVersioning.js for centralized version management

/**
 * Gets extension settings, merged with defaults
 * @returns {Promise<Settings>} Settings object with defaults applied
 */
export async function getSettings() {
  const res = await storage.getLocal("settings");

  const defaults = {
    ...DEFAULT_SETTINGS,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  if (!res.settings) {
    return defaults;
  }
  // Merge with defaults to ensure new keys exist
  return { ...defaults, ...res.settings };
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

  // Initialize settings if missing
  let settings = await getSettings();
  if (!settings) {
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


async function restoreTabs(tabs) {
  const groups = {};
  const ungrouped = [];

  tabs.forEach((tab) => {
    if (tab.groupId) {
      if (!groups[tab.groupId]) groups[tab.groupId] = [];
      groups[tab.groupId].push(tab);
    } else {
      ungrouped.push(tab);
    }
  });

  const restoredTabs = [];
  const failedTabs = []; // Track failures if we want to retain them (Safety)

  // process groups
  for (const groupId in groups) {
    const groupTabs = groups[groupId];
    if (groupTabs.length > 0) {
      groupTabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const urls = groupTabs.map((t) => t.url);
      try {
        let createdWindow = await windows.create({ url: urls, focused: true });

        if (createdWindow && !createdWindow.tabs) {
             try {
                 createdWindow = await windows.get(createdWindow.id, { populate: true });
             } catch (e) {}
        }

        if (createdWindow && createdWindow.tabs && createdWindow.tabs.length === urls.length) {
            restoredTabs.push(...groupTabs);
        } else {
            console.warn(`Partial restore detected for group ${groupId}. Preserving tabs.`);
            // Do not add to restoredTabs -> Not removed from storage
        }
      } catch (e) {
        console.error("Failed to restore group:", groupId, e);
        failedTabs.push(...groupTabs);
      }
    }
  }

  // process ungrouped
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
      const results = await createTabsInWindow(ungrouped, targetWindow);
      results.forEach((result, i) => {
        if (result.success) {
          restoredTabs.push(ungrouped[i]);
        }
      });
    }
  }

  // Cleanup storage
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
