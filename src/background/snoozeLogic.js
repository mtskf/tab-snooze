import { generateUUID } from '../utils/uuid.js';
// Validation utilities (inlined to avoid chunk splitting issues with Service Worker)
const REQUIRED_TAB_FIELDS = ['url', 'creationTime', 'popTime'];

function validateTabEntry(tab) {
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

function validateSnoozedTabs(data) {
  const errors = [];
  let repairable = true;
  if (data === null || data === undefined) {
    return { valid: false, errors: ['Data is null or undefined'], repairable: false };
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Data is not an object'], repairable: false };
  }
  if (!('tabCount' in data)) {
    errors.push('Missing tabCount key');
  } else if (typeof data.tabCount !== 'number' || data.tabCount < 0) {
    errors.push('tabCount is not a valid non-negative number');
  }
  let actualTabCount = 0;
  for (const key of Object.keys(data)) {
    if (key === 'tabCount') continue;
    const timestamp = parseInt(key, 10);
    if (isNaN(timestamp) || String(timestamp) !== key) {
      errors.push(`Invalid timestamp key: ${key}`);
      continue;
    }
    const entries = data[key];
    if (!Array.isArray(entries)) {
      errors.push(`Value for timestamp ${key} is not an array`);
      repairable = false;
      continue;
    }
    for (let i = 0; i < entries.length; i++) {
      const result = validateTabEntry(entries[i]);
      if (result.valid) {
        actualTabCount++;
      } else {
        errors.push(`Invalid tab at ${key}[${i}]: ${result.errors.join(', ')}`);
      }
    }
  }
  const hasCriticalErrors = errors.some(e =>
    e.includes('not an object') || e.includes('not an array')
  );
  if (data.tabCount !== undefined && actualTabCount !== data.tabCount) {
    errors.push(`tabCount mismatch: expected ${actualTabCount}, got ${data.tabCount}`);
  }
  return { valid: errors.length === 0, errors, repairable: repairable && !hasCriticalErrors };
}

function sanitizeSnoozedTabs(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { tabCount: 0 };
  }
  const sanitized = {};
  let tabCount = 0;
  for (const key of Object.keys(data)) {
    if (key === 'tabCount') continue;
    const timestamp = parseInt(key, 10);
    if (isNaN(timestamp) || String(timestamp) !== key) continue;
    const entries = data[key];
    if (!Array.isArray(entries)) continue;
    const validEntries = entries.filter(entry => validateTabEntry(entry).valid);
    if (validEntries.length > 0) {
      sanitized[key] = validEntries;
      tabCount += validEntries.length;
    }
  }
  sanitized.tabCount = tabCount;
  return sanitized;
}

// Default settings (inlined to avoid chunk splitting issues with Service Worker)
const DEFAULT_SETTINGS = {
  "start-day": "8:00 AM",
  "end-day": "5:00 PM",
  "week-begin": 1,
  "weekend-begin": 6,

};

// Backup configuration
const BACKUP_COUNT = 3;
const BACKUP_DEBOUNCE_MS = 2000;
const BACKUP_PREFIX = 'snoozedTabs_backup_';
let backupTimer = null;

// Storage size warning configuration
const STORAGE_LIMIT = 10 * 1024 * 1024;          // 10MB
const WARNING_THRESHOLD = 0.8 * STORAGE_LIMIT;   // 80% = 8MB
const CLEAR_THRESHOLD = 0.7 * STORAGE_LIMIT;     // 70% = 7MB
const THROTTLE_MS = 24 * 60 * 60 * 1000;         // 24 hours

/**
 * Check storage size and warn user if approaching limit.
 * Uses hysteresis (80%/70%) to prevent flapping.
 * Gracefully handles Firefox (getBytesInUse not available).
 */
export async function checkStorageSize() {
  try {
    // Firefox doesn't support getBytesInUse - silently skip
    if (typeof chrome.storage.local.getBytesInUse !== 'function') {
      return;
    }

    const bytesUsed = await chrome.storage.local.getBytesInUse(null);
    const storage = await chrome.storage.local.get(['sizeWarningActive', 'lastSizeWarningAt']);
    const wasActive = storage.sizeWarningActive || false;
    const lastWarningAt = storage.lastSizeWarningAt;
    const now = Date.now();

    let shouldBeActive = wasActive;

    // Hysteresis logic
    if (bytesUsed > WARNING_THRESHOLD) {
      shouldBeActive = true;
    } else if (bytesUsed < CLEAR_THRESHOLD) {
      shouldBeActive = false;
    }
    // In hysteresis zone (70-80%): keep current state

    // Update state if changed
    if (shouldBeActive !== wasActive) {
      await chrome.storage.local.set({ sizeWarningActive: shouldBeActive });
    }

    // Show notification if threshold exceeded and not throttled
    if (shouldBeActive && !wasActive) {
      const shouldNotify = !lastWarningAt || (now - lastWarningAt) > THROTTLE_MS;
      if (shouldNotify) {
        await chrome.notifications.create('storage-warning', {
          type: 'basic',
          iconUrl: 'assets/icon128.png',
          title: 'Snooooze storage is almost full',
          message: 'Open Snoozed list to delete or restore old tabs.',
          priority: 1
        });
        await chrome.storage.local.set({ lastSizeWarningAt: now });
      }
    }
  } catch (e) {
    // Firefox or other error - silently ignore
    console.warn('Storage size check failed:', e);
  }
}

// Storage helper functions (exported for use by serviceWorker.js)
export async function getSnoozedTabs() {
  const res = await chrome.storage.local.get("snoozedTabs");
  return res.snoozedTabs;
}

export async function setSnoozedTabs(val) {
  await chrome.storage.local.set({ snoozedTabs: val });
  // Schedule debounced backup rotation
  scheduleBackupRotation(val);
}

/**
 * Schedule a debounced backup rotation and storage size check
 */
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

/**
 * Rotate backups: keep only BACKUP_COUNT generations
 */
async function rotateBackups(data) {
  // Only backup valid data
  const validation = validateSnoozedTabs(data);
  if (!validation.valid && !validation.repairable) {
    return; // Don't backup invalid data
  }

  const dataToBackup = validation.valid ? data : sanitizeSnoozedTabs(data);

  try {
    // Get all backup keys
    const allStorage = await chrome.storage.local.get(null);
    const backupKeys = Object.keys(allStorage)
      .filter(k => k.startsWith(BACKUP_PREFIX))
      .sort((a, b) => {
        const tsA = parseInt(a.replace(BACKUP_PREFIX, ''), 10);
        const tsB = parseInt(b.replace(BACKUP_PREFIX, ''), 10);
        return tsB - tsA; // Newest first
      });

    // Create new backup
    const newBackupKey = `${BACKUP_PREFIX}${Date.now()}`;
    await chrome.storage.local.set({ [newBackupKey]: dataToBackup });

    // Delete old backups beyond BACKUP_COUNT
    const keysToDelete = backupKeys.slice(BACKUP_COUNT - 1); // -1 because we just added one
    if (keysToDelete.length > 0) {
      await chrome.storage.local.remove(keysToDelete);
    }
  } catch (e) {
    // Backup failed, but don't crash the extension
    console.warn('Backup rotation failed:', e);
  }
}

/**
 * Get snoozed tabs with validation and auto-recovery
 */
export async function getValidatedSnoozedTabs() {
  const data = await getSnoozedTabs();
  const result = validateSnoozedTabs(data);

  if (!result.valid) {
    if (result.repairable) {
      // Data can be repaired
      const sanitized = sanitizeSnoozedTabs(data);
      await setSnoozedTabs(sanitized);
      return sanitized;
    } else {
      // Data is corrupted, try to recover from backup
      const recovery = await recoverFromBackup();
      // Set session flag for notification (same as initStorage)
      if (recovery.recovered) {
        if (chrome.storage.session) {
          await chrome.storage.session.set({ pendingRecoveryNotification: recovery.tabCount });
        }
      }
      return recovery.data;
    }
  }

  return data;
}

/**
 * Recover from backup if primary data is corrupted
 * @returns {object} Recovered data or empty state
 */
export async function recoverFromBackup() {
  const allStorage = await chrome.storage.local.get(null);
  const backupKeys = Object.keys(allStorage)
    .filter(k => k.startsWith(BACKUP_PREFIX))
    .sort((a, b) => {
      const tsA = parseInt(a.replace(BACKUP_PREFIX, ''), 10);
      const tsB = parseInt(b.replace(BACKUP_PREFIX, ''), 10);
      return tsB - tsA; // Newest first
    });

  // Try each backup in order
  for (const key of backupKeys) {
    const backupData = allStorage[key];
    const validation = validateSnoozedTabs(backupData);

    if (validation.valid || validation.repairable) {
      const restoredData = validation.valid ? backupData : sanitizeSnoozedTabs(backupData);
      await chrome.storage.local.set({ snoozedTabs: restoredData });

      // Return info for notification
      return {
        data: restoredData,
        recovered: true,
        tabCount: restoredData.tabCount || 0
      };
    }
  }

  // No valid backups, reset to empty state
  const emptyState = { tabCount: 0 };
  await chrome.storage.local.set({ snoozedTabs: emptyState });
  return {
    data: emptyState,
    recovered: false,
    tabCount: 0
  };
}

/**
 * Create initial backup for existing users (migration)
 * Only runs once when no backups exist but valid data exists
 */
async function createInitialBackupIfNeeded(snoozedTabs) {
  if (!snoozedTabs || snoozedTabs.tabCount === 0) {
    return; // No data to backup
  }

  // Check if any backups already exist
  const allStorage = await chrome.storage.local.get(null);
  const hasBackups = Object.keys(allStorage).some(k => k.startsWith(BACKUP_PREFIX));

  if (!hasBackups) {
    // Create initial backup
    const validation = validateSnoozedTabs(snoozedTabs);
    if (validation.valid || validation.repairable) {
      const dataToBackup = validation.valid ? snoozedTabs : sanitizeSnoozedTabs(snoozedTabs);
      const backupKey = `${BACKUP_PREFIX}${Date.now()}`;
      await chrome.storage.local.set({ [backupKey]: dataToBackup });
    }
  }
}

/**
 * Tries to recover data from backups if main storage is corrupted/empty
 */
export async function ensureSnoozedTabs() {
  const current = await getSnoozedTabs();
  const validation = validateSnoozedTabs(current);

  if (!validation.valid) {
    if (validation.repairable) {
        // Option 1: Repair in-place
        const sanitized = sanitizeSnoozedTabs(current);
        await setSnoozedTabs(sanitized);
        return sanitized;
    } else {
        // Option 2: Recover from backup
        const recovery = await recoverFromBackup();
        if (recovery.recovered) {
            // Notify user about recovery
             if (chrome.storage.session) {
                await chrome.storage.session.set({ pendingRecoveryNotification: recovery.tabCount });
             }
        }
        return recovery.data;
    }
  }
  return current;
}

// --- Main Logic ---

async function addToStorage(snoozedTabs) {
    if (!snoozedTabs || snoozedTabs.tabCount === 0) return;

    // Fail-safe: Check if we are about to overwrite valid data with potentially less data (without user action)
    const all = await chrome.storage.local.get(null);
    if (!Object.keys(all).some(k => k.startsWith(BACKUP_PREFIX))) {
       // First time saving or no backups? Validate strictly
       const validation = validateSnoozedTabs(snoozedTabs);
       if (validation.valid || validation.repairable) {
          const toSave = validation.valid ? snoozedTabs : sanitizeSnoozedTabs(snoozedTabs);
          // Force a backup immediately if none exist
          const newBackupKey = `${BACKUP_PREFIX}${Date.now()}`;
          await chrome.storage.local.set({ [newBackupKey]: toSave });
       }
    }
}

export async function getSettings() {
  const res = await chrome.storage.local.get("settings");
  return res.settings;
}

export async function setSettings(val) {
  await chrome.storage.local.set({ settings: val });
}

// Initialization
export async function initStorage() {
  // Get and validate snoozed tabs, recovering from backup if needed
  const rawData = await getSnoozedTabs();
  const validation = validateSnoozedTabs(rawData);
  let snoozedTabs;

  if (!rawData) {
    // First install: no data exists
    snoozedTabs = { tabCount: 0 };
    await setSnoozedTabs(snoozedTabs);
  } else if (!validation.valid) {
    if (validation.repairable) {
      // Repairable issues: sanitize and save
      snoozedTabs = sanitizeSnoozedTabs(rawData);
      await setSnoozedTabs(snoozedTabs);
    } else {
      // Corrupted data: recover from backup
      const recovery = await recoverFromBackup();
      snoozedTabs = recovery.data;
      // Note: notification will be handled by serviceWorker if recovery.recovered is true
      if (recovery.recovered) {
        // Store recovery flag for notification (will be read by serviceWorker)
        if (chrome.storage.session) {
          await chrome.storage.session.set({ pendingRecoveryNotification: recovery.tabCount });
        }
      }
    }
  } else {
    snoozedTabs = rawData;
  }

  // Migration: create initial backup for existing users
  await createInitialBackupIfNeeded(snoozedTabs);

  let settings = await getSettings();
  if (!settings) {
    await setSettings({ ...DEFAULT_SETTINGS });
  }

  // Check storage size on startup
  await checkStorageSize();
}

// Promise-chain mutex for storage operations
let storageLock = Promise.resolve();

// Inner helper that modifies the object reference (synchronous)
function removeSnoozedTab(tab, snoozedTabs) {
  // tab.popTime might be string or number
  const popTime = new Date(tab.popTime).getTime();
  const popSet = snoozedTabs[popTime];

  if (!popSet) return; // not found

  let tabIndex = -1;
  const targetId = tab.id;
  const targetCreationTime = new Date(tab.creationTime).getTime();

  for (let i = 0; i < popSet.length; i++) {
     // Use ID if available
     if (targetId && popSet[i].id) {
         if (targetId === popSet[i].id) {
             tabIndex = i;
             break;
         }
     } else {
         // Fallback
         // Note: storage JSON cycle might turn dates to strings, so safer to compare timestamps
         const itemTime = new Date(popSet[i].creationTime).getTime();
         if (itemTime === targetCreationTime && popSet[i].url === tab.url) {
             tabIndex = i;
             break;
         }
     }
  }

  if (tabIndex < 0) return;

  popSet.splice(tabIndex, 1);

  if (popSet.length === 0) {
    delete snoozedTabs[popTime];
  } else {
    snoozedTabs[popTime] = popSet;
  }

  snoozedTabs["tabCount"] = Math.max(0, (snoozedTabs["tabCount"] || 0) - 1);
}

async function addSnoozedTab(tab, popTime, groupId = null) {
  // Wrap the logic in the lock
  const task = storageLock.then(async () => {
    let snoozedTabs = await getSnoozedTabs();
    if (!snoozedTabs) {
      snoozedTabs = { tabCount: 0 };
    }
    const fullTime = popTime.getTime();

    if (!snoozedTabs[fullTime]) {
      snoozedTabs[fullTime] = [];
    }

    snoozedTabs[fullTime].push({
      id: generateUUID(),
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl || tab.favicon,
      creationTime: new Date().getTime(),
      popTime: popTime.getTime(),
      groupId: groupId,
      index: tab.index,
    });

    snoozedTabs["tabCount"] = (snoozedTabs["tabCount"] || 0) + 1;

    await setSnoozedTabs(snoozedTabs);
  });

  storageLock = task.catch((e) => {});
  return task;
}

// Logic Functions

export async function snooze(tab, popTime, groupId = null) {
  const popTimeObj = new Date(popTime);

  // Check against restricted protocols to avoid restoration failures or data loss risks
  try {
      const url = new URL(tab.url);
      // chrome:, edge:, braid:, about:, chrome-extension:
      // Also file: (local files usually need specific permissions)
      const RESTRICTED = ['chrome:', 'edge:', 'brave:', 'about:', 'chrome-extension:', 'file:'];
      if (RESTRICTED.some(p => url.protocol === p)) {
          console.warn(`Skipping restricted URL: ${tab.url}`);
          return;
      }
  } catch (e) {
      console.warn("Invalid URL for snooze:", tab.url);
      return;
  }

  // CRITICAL: Save to storage FIRST before closing tab
  try {
    await addSnoozedTab(tab, popTimeObj, groupId);
  } catch (e) {
    console.error("Failed to save snoozed tab:", e);
    throw e;
  }

  try {
    await chrome.tabs.remove(tab.id);
  } catch (e) {
    // Tab may already be closed
  }
}

// Restoration Lock
let isRestoring = false;

export async function popCheck() {
  if (isRestoring || !navigator.onLine) {
    return 0;
  }

  const snoozedTabs = await getSnoozedTabs();
  if (!snoozedTabs) return 0;

  const timestamps = Object.keys(snoozedTabs).sort();
  const tabsToPop = [];
  const timesToRemove = [];
  const now = Date.now();

  for (let i = 0; i < timestamps.length; i++) {
    const timeStr = timestamps[i];
    if (timeStr === "tabCount") continue;

    const time = parseInt(timeStr);
    if (isNaN(time)) continue;

    if (time < now) {
      timesToRemove.push(timeStr);
      tabsToPop.push(...snoozedTabs[timeStr]);
    }
  }

  if (tabsToPop.length > 0) {
    try {
      isRestoring = true;
      await restoreTabs(tabsToPop, timesToRemove);
    } finally {
      isRestoring = false;
    }
  }

  return { count: tabsToPop.length };
}

async function restoreTabs(tabs, timesToRemove) {
  const groups = {};
  const ungrouped = [];

  tabs.forEach((tab) => {
    if (tab.groupId) {
      if (!groups[tab.groupId]) {
        groups[tab.groupId] = [];
      }
      groups[tab.groupId].push(tab);
    } else {
      ungrouped.push(tab);
    }
  });

  const restoredTabs = [];
  const failedTabs = [];

  for (const groupId in groups) {
    const groupTabs = groups[groupId];
    if (groupTabs.length > 0) {
      groupTabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const urls = groupTabs.map((t) => t.url);
      try {
        let createdWindow = await chrome.windows.create({ url: urls, focused: true });

        // MV3 Note: create() might not return tabs property in some cases/environments.
        // If missing, we must fetch the window again to verify the tab count.
        if (createdWindow && !createdWindow.tabs) {
             try {
                 createdWindow = await chrome.windows.get(createdWindow.id, { populate: true });
             } catch (e) {
                 console.warn("Failed to refetch window for verification:", e);
                 // If we can't verify, we should probably assume success to avoid massive duplication,
                 // OR assume failure to be safe.
                 // Given we just created it, failure to get it often means it closed immediately or ID is wrong?
                 // Let's rely on createdWindow existence.
             }
        }

        // Partial Failure Detection:
        // If some URLs were ignored (e.g. invalid), chrome creates a window with fewer tabs.
        // We verify the count to ensure all were restored.
        if (createdWindow && createdWindow.tabs && createdWindow.tabs.length === urls.length) {
            restoredTabs.push(...groupTabs);
        } else {
            console.warn(`Partial restore detected for group ${groupId}. Preserving tabs in storage.`);
            // Do NOT add to restoredTabs -> They will remain in storage (safety duplicate)
        }
      } catch (e) {
        console.error("Failed to restore group:", groupId, e);
        failedTabs.push(...groupTabs);
      }
    }
  }

  if (ungrouped.length > 0) {
    let targetWindow;
    try {
      targetWindow = await chrome.windows.getLastFocused();
    } catch (e) {
      try {
        targetWindow = await chrome.windows.create({});
      } catch (e2) {
        failedTabs.push(...ungrouped);
        targetWindow = null;
      }
    }

    if (targetWindow) {
      const results = await createTabsInWindow(ungrouped, targetWindow);
      results.forEach((result, i) => {
        if (result.success) {
          restoredTabs.push(ungrouped[i]);
        } else {
          failedTabs.push(ungrouped[i]);
        }
      });
    }
  }

  // Cleanup storage
  const cleanupTask = storageLock.then(async () => {
    const currentSnoozedTabs = await getSnoozedTabs();
    if (!currentSnoozedTabs) return;

    for (let i = 0; i < timesToRemove.length; i++) {
      const timeKey = timesToRemove[i];
      if (!currentSnoozedTabs[timeKey]) continue;

      const originalTabs = currentSnoozedTabs[timeKey];
      const remainingTabs = originalTabs.filter(t =>
        !restoredTabs.some(r => {
             if (t.id && r.id) return t.id === r.id;
             return t.url === r.url && t.creationTime === r.creationTime;
        })
      );

      if (remainingTabs.length === 0) {
        delete currentSnoozedTabs[timeKey];
      } else {
        currentSnoozedTabs[timeKey] = remainingTabs;
      }
    }

    let newCount = 0;
    Object.keys(currentSnoozedTabs).forEach(k => {
        if (k !== 'tabCount' && Array.isArray(currentSnoozedTabs[k])) {
            newCount += currentSnoozedTabs[k].length;
        }
    });
    currentSnoozedTabs.tabCount = newCount;

    await setSnoozedTabs(currentSnoozedTabs);
  });

  // Chain cleanup to global lock so subsequent operations wait for it
  storageLock = cleanupTask.catch(() => {});

  // Wait for cleanup to finish and log errors if any
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
    await chrome.tabs.create({
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

function getTabsByGroupId(snoozedTabs, groupId) {
  const timestamps = Object.keys(snoozedTabs);
  let groupTabs = [];
  for (const ts of timestamps) {
    if (ts === "tabCount") continue;
    const tabs = snoozedTabs[ts];
    if (!Array.isArray(tabs)) continue;
    const matchingTabs = tabs.filter((t) => t.groupId === groupId);
    groupTabs = groupTabs.concat(matchingTabs);
  }
  return groupTabs;
}

export async function restoreWindowGroup(groupId) {
  const snoozedTabs = await getSnoozedTabs();
  if (!snoozedTabs) return;

  const groupTabs = getTabsByGroupId(snoozedTabs, groupId);
  if (groupTabs.length === 0) return;

  groupTabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const urls = groupTabs.map((t) => t.url);
  await chrome.windows.create({ url: urls, focused: true });
  await removeWindowGroup(groupId);
}

export async function removeSnoozedTabWrapper(tab) {
  storageLock = storageLock
    .then(async () => {
      const snoozedTabs = await getSnoozedTabs();
      if (!snoozedTabs) return;

      removeSnoozedTab(tab, snoozedTabs);
      await setSnoozedTabs(snoozedTabs);
    })
    .catch((err) => {
      console.warn("Error removing snoozed tab:", err);
    });
  return storageLock;
}

export async function removeWindowGroup(groupId) {
  storageLock = storageLock
    .then(async () => {
      const snoozedTabs = await getSnoozedTabs();
      if (!snoozedTabs) return;

      const timestamps = Object.keys(snoozedTabs);
      let removedCount = 0;

      for (const ts of timestamps) {
        if (ts === "tabCount") continue;
        const tabs = snoozedTabs[ts];
        if (!Array.isArray(tabs)) continue;

        const originalLength = tabs.length;
        const newTabs = tabs.filter((t) => t.groupId !== groupId);

        if (newTabs.length !== originalLength) {
          removedCount += originalLength - newTabs.length;
          if (newTabs.length === 0) {
            delete snoozedTabs[ts];
          } else {
            snoozedTabs[ts] = newTabs;
          }
        }
      }

      snoozedTabs["tabCount"] = Math.max(
        0,
        (snoozedTabs["tabCount"] || 0) - removedCount
      );
      await setSnoozedTabs(snoozedTabs);
    })
    .catch((err) => {
      console.warn("Error removing window group:", err);
    });
  return storageLock;
}
