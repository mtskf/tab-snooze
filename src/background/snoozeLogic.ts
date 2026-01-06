/**
 * Snooze Logic
 *
 * Core business logic for snoozing and restoring tabs.
 */

import type { SnoozedItemV2, StorageV2, Settings, RecoveryResult } from '../types';
import { generateUUID } from '../utils/uuid';
import { storage, tabs, windows, notifications } from '../utils/ChromeApi';
import { validateSnoozedTabsV2, sanitizeSnoozedTabsV2, isRestorableUrl } from '../utils/validation';
import { DEFAULT_SETTINGS, BACKUP_COUNT, BACKUP_DEBOUNCE_MS, BACKUP_PREFIX, WARNING_THRESHOLD, CLEAR_THRESHOLD, THROTTLE_MS } from '../utils/constants';
import { getSettingsWithDefaults } from '../utils/settingsHelper';
import { ensureValidStorage, detectSchemaVersion, runMigrations, CURRENT_SCHEMA_VERSION } from './schemaVersioning';

// Backup configuration
let backupTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Check storage size and warn user if approaching limit.
 */
export async function checkStorageSize(): Promise<void> {
  try {
    const bytesUsed = await storage.getBytesInUse(null);
    const storageData = await storage.getLocal(['sizeWarningActive', 'lastSizeWarningAt']);
    const wasActive = (storageData.sizeWarningActive as boolean) || false;

    // If API is unsupported (returns 0), clear any existing warning and skip check
    if (bytesUsed === 0) {
      if (wasActive) {
        await storage.setLocal({ sizeWarningActive: false });
      }
      return;
    }

    const lastWarningAt = storageData.lastSizeWarningAt as number | undefined;
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
 */
async function getStorageV2(): Promise<StorageV2> {
  const res = await storage.getLocal("snoooze_v2");
  const data = res.snoooze_v2 as StorageV2 | undefined;

  // Helper to validate plain object (not null, not array)
  const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);

  // Handle completely missing or invalid data
  if (!isPlainObject(data)) {
    return { version: 2, items: {}, schedule: {} };
  }

  // Ensure items and schedule are valid plain objects
  return {
    version: data.version || 2,
    items: isPlainObject(data.items) ? data.items as Record<string, SnoozedItemV2> : {},
    schedule: isPlainObject(data.schedule) ? data.schedule as Record<string, string[]> : {}
  };
}

/**
 * Saves V2 storage and schedules backup rotation
 */
async function saveStorageV2(v2Data: StorageV2): Promise<void> {
  await storage.setLocal({ snoooze_v2: v2Data });
  scheduleBackupRotation(v2Data);
}

/**
 * Write Adapter (V1 -> V2)
 * Used if legacy code calls setSnoozedTabs. Converts structure and saves V2.
 * Uses storageLock to prevent race conditions with other storage operations
 */
export async function setSnoozedTabs(legacyData: unknown): Promise<void> {
  // Detect source version and migrate to current version (can be done outside lock)
  const sourceVersion = detectSchemaVersion(legacyData);

  // Reject future schema versions (cannot downgrade)
  if (sourceVersion !== null && sourceVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(`Cannot import data from future schema version ${sourceVersion}. Current version is ${CURRENT_SCHEMA_VERSION}.`);
  }

  // Prepare data outside lock
  let v2Data: StorageV2;
  if (sourceVersion === null) {
    // Empty/invalid data - use empty V2
    v2Data = { version: CURRENT_SCHEMA_VERSION, items: {}, schedule: {} };
  } else {
    // Migrate from source version to current version
    v2Data = await runMigrations(legacyData, sourceVersion, CURRENT_SCHEMA_VERSION);
    // Ensure version field is always present (even if source == target)
    if (!v2Data.version) {
      v2Data = { ...v2Data, version: CURRENT_SCHEMA_VERSION };
    }
  }

  // Use storageLock for the storage write
  const task = storageLock.then(async () => {
    await storage.setLocal({ snoooze_v2: v2Data });
  });

  storageLock = task.catch(() => { /* ignore */ });
  return task;
}

// --- Backup & Rotation ---

function scheduleBackupRotation(data: StorageV2): void {
  if (backupTimer) {
    clearTimeout(backupTimer);
  }
  backupTimer = setTimeout(async () => {
    backupTimer = null;
    await rotateBackups(data);
    await checkStorageSize();
  }, BACKUP_DEBOUNCE_MS);
}

async function rotateBackups(data: StorageV2): Promise<void> {
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
 */
export async function getSnoozedTabsV2(): Promise<StorageV2> {
  const v2Data = await getStorageV2();
  const validation = validateSnoozedTabsV2(v2Data);

  if (!validation.valid) {
    console.warn('V2 validation errors during read, sanitizing and persisting:', validation.errors);
    const sanitized = sanitizeSnoozedTabsV2(v2Data);
    const result: StorageV2 = { ...sanitized, version: 2 };
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
 */
export async function getExportData(): Promise<StorageV2> {
  return await getSnoozedTabsV2();
}

interface ImportResult {
  success: boolean;
  addedCount?: number;
  error?: string;
}

/**
 * Imports tabs from raw data (V1 or V2 format)
 * Uses storageLock to prevent race conditions with other storage operations
 */
export async function importTabs(rawData: unknown): Promise<ImportResult> {
  // Validate input is an object (can be done outside lock)
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    return { success: false, error: 'Invalid data structure' };
  }

  // Detect schema version (can be done outside lock)
  const sourceVersion = detectSchemaVersion(rawData);

  if (sourceVersion === null) {
    // Empty or invalid data
    return { success: true, addedCount: 0 };
  }

  // Reject future schema versions (can be done outside lock)
  if (sourceVersion > CURRENT_SCHEMA_VERSION) {
    return {
      success: false,
      error: `Cannot import data from future schema version ${sourceVersion}`
    };
  }

  // Migrate to V2 if needed (can be done outside lock)
  let importV2Data: StorageV2 = sourceVersion === CURRENT_SCHEMA_VERSION
    ? rawData as StorageV2
    : await runMigrations(rawData, sourceVersion, CURRENT_SCHEMA_VERSION);

  // Ensure version field
  importV2Data = { ...importV2Data, version: CURRENT_SCHEMA_VERSION };

  // Validate and sanitize import data (can be done outside lock)
  const validation = validateSnoozedTabsV2(importV2Data);
  if (!validation.valid) {
    console.warn('Import data validation errors, sanitizing:', validation.errors);
    importV2Data = { ...sanitizeSnoozedTabsV2(importV2Data), version: CURRENT_SCHEMA_VERSION };
  }

  // Count items to add
  const itemsToImport = Object.keys(importV2Data.items || {}).length;
  if (itemsToImport === 0) {
    return { success: true, addedCount: 0 };
  }

  // Use storageLock for the read-modify-write cycle
  const task = storageLock.then(async () => {
    // Get existing data (inside lock to ensure consistency)
    const existingData = await getStorageV2();

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
    const mergedData: StorageV2 = {
      version: CURRENT_SCHEMA_VERSION,
      items: mergedItems,
      schedule: mergedSchedule
    };
    await saveStorageV2(mergedData);
  });

  storageLock = task.catch(() => { /* ignore */ });

  try {
    await task;
    return { success: true, addedCount: itemsToImport };
  } catch (error) {
    console.error('Import failed:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Recovers snoozed tabs from backup storage
 */
export async function recoverFromBackup(): Promise<RecoveryResult> {
  // V2 Recovery logic: Try to find fully valid backup first, then fall back to sanitized
  const allStorage = await storage.getLocal(null);
  const backupKeys = Object.keys(allStorage)
    .filter(k => k.startsWith(BACKUP_PREFIX))
    .sort((a, b) => parseInt(b.replace(BACKUP_PREFIX, '')) - parseInt(a.replace(BACKUP_PREFIX, '')));

  // First pass: Search for fully valid backup
  for (const key of backupKeys) {
    const backupData = allStorage[key] as StorageV2 | undefined;
    if (backupData && backupData.items && backupData.schedule) {
      const validation = validateSnoozedTabsV2(backupData);
      if (validation.valid) {
        await storage.setLocal({ snoooze_v2: backupData });
        return { recovered: true, tabCount: Object.keys(backupData.items).length };
      }
    }
  }

  // Second pass: No valid backup found, try finding the BEST sanitized backup (most items)
  let bestCandidate: { items: Record<string, SnoozedItemV2>; schedule: Record<string, string[]> } | null = null;
  let maxItems = -1;

  for (const key of backupKeys) {
    const backupData = allStorage[key] as StorageV2 | undefined;
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

/**
 * Gets extension settings, merged with defaults
 */
export async function getSettings(): Promise<Settings> {
  return getSettingsWithDefaults();
}

/**
 * Updates extension settings
 */
export async function setSettings(val: Partial<Settings>): Promise<void> {
  await storage.setLocal({ settings: val });
}

// --- Initialization ---

export async function initStorage(): Promise<void> {
  const all = await storage.getLocal(null);

  // Check if V2 data exists but is invalid - trigger recovery if needed
  const validation = validateSnoozedTabsV2(all.snoooze_v2 as StorageV2 | undefined);
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
function removeSnoozedTabV2(tabId: string, v2Data: StorageV2): void {
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

interface TabInput {
  url: string;
  title?: string;
  favIconUrl?: string;
  favicon?: string | null;
  index?: number;
  id?: number | string;
}

async function addSnoozedTab(tab: TabInput, popTime: Date, groupId: string | null = null): Promise<void> {
  const task = storageLock.then(async () => {
    const v2Data = await getStorageV2();

    const id = generateUUID();
    const entry: SnoozedItemV2 = {
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

  storageLock = task.catch(() => { /* ignore */ });
  return task;
}


export async function snooze(tab: TabInput, popTime: number, groupId: string | null = null): Promise<void> {
  const popTimeObj = new Date(popTime);

  if (!isRestorableUrl(tab.url)) {
    console.warn("Skipping invalid/restricted URL:", tab.url);
    return;
  }

  try {
    await addSnoozedTab(tab, popTimeObj, groupId);
  } catch (e) {
    console.error("Failed to save snoozed tab:", e);
    throw e;
  }

  try {
    // Only close if it's a real tab (number ID), not a re-snoozed item (string ID)
    if (typeof tab.id === 'number') {
      await tabs.remove(tab.id);
    }
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
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
}

/**
 * Executes an async function with retry logic
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  delayMs: number = RETRY_DELAY_MS
): Promise<RetryResult<T>> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { success: true, result };
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await delay(delayMs);
      }
    }
  }
  return { success: false, error: lastError };
}

interface PopCheckResult {
  count: number;
}

export async function popCheck(): Promise<PopCheckResult | number> {
  if (isRestoring || !navigator.onLine) {
    return 0;
  }

  const v2Data = await getStorageV2();
  const now = Date.now();

  const tabsToPop: SnoozedItemV2[] = [];

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


async function restoreTabs(tabsToRestore: SnoozedItemV2[]): Promise<void> {
  const groups: Record<string, SnoozedItemV2[]> = {};
  const ungrouped: SnoozedItemV2[] = [];

  tabsToRestore.forEach((tab) => {
    if (tab.groupId) {
      if (!groups[tab.groupId]) groups[tab.groupId] = [];
      groups[tab.groupId].push(tab);
    } else {
      ungrouped.push(tab);
    }
  });

  const restoredTabs: SnoozedItemV2[] = [];
  const failedTabs: SnoozedItemV2[] = [];

  // Process groups with retry
  for (const groupId in groups) {
    const groupTabs = groups[groupId];
    if (groupTabs.length > 0) {
      groupTabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const urls = groupTabs.map((t) => t.url);

      const { success } = await withRetry(async () => {
        let win = await windows.create({ url: urls, focused: true });
        if (win && !win.tabs) {
          try {
            win = await windows.get(win.id!, { populate: true });
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
    let targetWindow: chrome.windows.Window | null | undefined = null;
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
            windowId: targetWindow!.id,
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

  storageLock = cleanupTask.catch(() => { /* ignore */ });
  await cleanupTask.catch(err => {
    console.error('Failed to cleanup storage after restore:', err);
  });
  await storageLock;
}

/**
 * Handles failed tabs by rescheduling them and notifying the user
 */
async function handleFailedTabs(failedTabs: SnoozedItemV2[]): Promise<void> {
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

  storageLock = rescheduleTask.catch(() => { /* ignore */ });
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


async function createTabsInWindow(tabList: SnoozedItemV2[], w: chrome.windows.Window): Promise<{ success: boolean }[]> {
  const promises = tabList.map((tab) => createTab(tab, w));
  return Promise.all(promises);
}

async function createTab(tab: SnoozedItemV2, w: chrome.windows.Window): Promise<{ success: boolean }> {
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
function getTabsByGroupIdV2(v2Data: StorageV2, groupId: string): SnoozedItemV2[] {
  // Scan items (O(N) but safer than maintaining another index for now)
  return Object.values(v2Data.items).filter(item => item.groupId === groupId);
}

export async function restoreWindowGroup(groupId: string): Promise<void> {
  const v2Data = await getStorageV2();

  const groupTabs = getTabsByGroupIdV2(v2Data, groupId);
  if (groupTabs.length === 0) return;

  groupTabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const urls = groupTabs.map((t) => t.url);

  let createdWindow = await windows.create({ url: urls, focused: true });

  if (createdWindow && !createdWindow.tabs) {
    try {
      createdWindow = await windows.get(createdWindow.id!, { populate: true });
    } catch (e) { /* ignore */ }
  }

  if (createdWindow && createdWindow.tabs && createdWindow.tabs.length === urls.length) {
    await removeWindowGroup(groupId);
  } else {
    console.warn(`Partial restore detected for manual group restore ${groupId}.`);
  }
}


export async function removeSnoozedTabWrapper(tab: SnoozedItemV2): Promise<void> {
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

export async function removeWindowGroup(groupId: string): Promise<void> {
  storageLock = storageLock
    .then(async () => {
      const v2Data = await getStorageV2();
      // Find IDs in group
      const itemIdsToRemove: string[] = [];
      for (const id in v2Data.items) {
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
