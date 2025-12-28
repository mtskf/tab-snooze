import { DEFAULT_SETTINGS } from "../utils/constants";

// Storage helper functions (exported for use by serviceWorker.js)
export async function getSnoozedTabs() {
  const res = await chrome.storage.local.get("snoozedTabs");
  return res.snoozedTabs;
}

export async function setSnoozedTabs(val) {
  await chrome.storage.local.set({ snoozedTabs: val });
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
  let snoozedTabs = await getSnoozedTabs();
  if (!snoozedTabs) {
    snoozedTabs = { tabCount: 0 };
    await setSnoozedTabs(snoozedTabs);
  }

  let settings = await getSettings();
  if (!settings) {
    await setSettings({ ...DEFAULT_SETTINGS });
  }

  await chrome.action.setBadgeBackgroundColor({ color: "#FED23B" });
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
