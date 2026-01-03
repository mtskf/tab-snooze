import { validateSnoozedTabs, sanitizeSnoozedTabs } from '../utils/validation';

// Default settings (inlined to avoid chunk splitting issues with Service Worker)
const DEFAULT_SETTINGS = {
  "start-day": "8:00 AM",
  "end-day": "5:00 PM",
  "week-begin": 1,
  "weekend-begin": 6,
  "open-new-tab": "true",
  badge: "true",
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
        await chrome.storage.session.set({ pendingRecoveryNotification: recovery.tabCount });
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
        await chrome.storage.session.set({ pendingRecoveryNotification: recovery.tabCount });
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

  await chrome.action.setBadgeBackgroundColor({ color: "#FED23B" });

  // Check storage size on startup
  await checkStorageSize();
}

// Logic Functions

export async function snooze(tab, popTime, openInNewWindow, groupId = null) {
  // Note: tab is passed from popup, might not be full Tab object but has necessary props
  // popTime comes as string or timestamp from message usually

  // Ensure popTime is handled correctly (if passed as string over JSON)
  const popTimeObj = new Date(popTime);

  // Remove tab
  try {
    await chrome.tabs.remove(tab.id);
  } catch (e) {
    // Tab may already be closed
  }

  // Add to storage
  await addSnoozedTab(tab, popTimeObj, openInNewWindow, groupId);
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
    if (timeStr === "tabCount") continue; // Skip counter key if present in keys

    const time = parseInt(timeStr); // keys are strings
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
  // Group by groupId
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

  // Restore Groups (Always in new window)
  for (const groupId in groups) {
    const groupTabs = groups[groupId];
    if (groupTabs.length > 0) {
      // Sort by original tab index to preserve order
      groupTabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const urls = groupTabs.map((t) => t.url);
      await chrome.windows.create({ url: urls, focused: true });
    }
  }

  // Restore Ungrouped Tabs (Always in last focused window)
  if (ungrouped.length > 0) {
    try {
      // Use getLastFocused for Service Worker compatibility
      const currentWindow = await chrome.windows.getLastFocused();
      await createTabsInWindow(ungrouped, currentWindow);
    } catch (e) {
      // Fallback if no window is focused/available
      const newWindow = await chrome.windows.create({});
      await createTabsInWindow(ungrouped, newWindow);
    }
  }

  // Cleanup storage
  // storageLock is a promise-chain mutex to prevent race conditions
  await storageLock.then(async () => {
    // Re-read storage inside the lock to get the latest state
    const currentSnoozedTabs = await getSnoozedTabs();
    if (!currentSnoozedTabs) return;

    for (let i = 0; i < timesToRemove.length; i++) {
      const timeKey = timesToRemove[i];
      // Only delete if it still exists (it should)
      if (currentSnoozedTabs[timeKey]) {
        delete currentSnoozedTabs[timeKey];
      }
    }

    // Decrement count safely
    currentSnoozedTabs["tabCount"] = Math.max(
      0,
      (currentSnoozedTabs["tabCount"] || 0) - tabs.length
    );

    await setSnoozedTabs(currentSnoozedTabs);
  });
}

// Parallel tab creation
async function createTabsInWindow(tabs, w) {
  const promises = tabs.map((tab) => createTab(tab, w));
  await Promise.all(promises);
}

async function createTab(tab, w) {
  try {
    await chrome.tabs.create({
      windowId: w.id,
      url: tab.url,
      active: false,
    });
  } catch (e) {
    // Tab creation failed
  }
}

// Promise-chain mutex for storage operations
let storageLock = Promise.resolve();

async function addSnoozedTab(tab, popTime, openInNewWindow, groupId = null) {
  // Wrap the logic in the lock
  storageLock = storageLock
    .then(async () => {
      const snoozedTabs = await getSnoozedTabs();
      const fullTime = popTime.getTime();

      if (!snoozedTabs[fullTime]) {
        snoozedTabs[fullTime] = [];
      }

      snoozedTabs[fullTime].push({
        url: tab.url,
        title: tab.title,
        favicon: tab.favIconUrl || tab.favicon,
        creationTime: new Date().getTime(),
        popTime: popTime.getTime(),
        openInNewWindow: !!openInNewWindow,
        groupId: groupId,
        index: tab.index,
      });

      snoozedTabs["tabCount"] = (snoozedTabs["tabCount"] || 0) + 1;

      await setSnoozedTabs(snoozedTabs);
    })
    .catch((err) => {
      // Error in storage lock
    });

  return storageLock;
}

// Helper: Get all tabs matching a specific groupId
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

  // 1. Gather Tabs using helper
  const groupTabs = getTabsByGroupId(snoozedTabs, groupId);

  if (groupTabs.length === 0) return;

  // 2. Sort by original tab index to preserve order
  groupTabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  // 3. Open in New Window
  const urls = groupTabs.map((t) => t.url);
  await chrome.windows.create({ url: urls, focused: true });

  // 4. Remove from storage
  await removeWindowGroup(groupId);
}

export async function removeSnoozedTabWrapper(tab) {
  const snoozedTabs = await getSnoozedTabs();
  removeSnoozedTab(tab, snoozedTabs);
  // removeSnoozedTab modifies object, we need to save it.
  await setSnoozedTabs(snoozedTabs);
}

// Inner helper that modifies the object reference (synchronous)
function removeSnoozedTab(tab, snoozedTabs) {
  // tab.popTime might be string or number
  const popTime = new Date(tab.popTime).getTime();
  const popSet = snoozedTabs[popTime];

  if (!popSet) return; // not found

  let tabIndex = -1;
  // creationTime is used as unique ID match
  const targetCreationTime = new Date(tab.creationTime).getTime();

  for (let i = 0; i < popSet.length; i++) {
    // Comparison of creation times
    // Note: storage JSON cycle might turn dates to strings, so safer to compare timestamps
    const itemTime = new Date(popSet[i].creationTime).getTime();

    if (itemTime === targetCreationTime) {
      tabIndex = i;
      break;
    }
  }

  if (tabIndex < 0) return;

  popSet.splice(tabIndex, 1);

  if (popSet.length === 0) {
    delete snoozedTabs[popTime];
  } else {
    snoozedTabs[popTime] = popSet;
  }

  snoozedTabs["tabCount"] = Math.max(0, snoozedTabs["tabCount"] - 1);
}

export async function removeWindowGroup(groupId) {
  const snoozedTabs = await getSnoozedTabs();
  const timestamps = Object.keys(snoozedTabs);
  let removedCount = 0;

  for (const ts of timestamps) {
    if (ts === "tabCount") continue;
    const tabs = snoozedTabs[ts];
    if (!Array.isArray(tabs)) continue;

    const originalLength = tabs.length;
    // Filter out tabs with the matching groupId
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
}
