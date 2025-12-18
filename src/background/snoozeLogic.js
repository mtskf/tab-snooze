import {
  getSnoozedTabs,
  setSnoozedTabs,
  getSettings,
  setSettings,
} from "../utils/storage";

// Initialization
export async function initStorage() {
  let snoozedTabs = await getSnoozedTabs();
  if (!snoozedTabs) {
    snoozedTabs = { tabCount: 0 };
    await setSnoozedTabs(snoozedTabs);
  }

  let settings = await getSettings();
  if (!settings) {
    settings = {
      "start-day": "9:00 AM",
      "end-day": "6:00 PM",
      "start-weekend": "10:00 AM",
      "week-begin": 1,
      "weekend-begin": 6,
      "later-today": 3,
      someday: 3,
      badge: "true",
    };
    await setSettings(settings);
  }

  await chrome.action.setBadgeBackgroundColor({ color: "#FED23B" });
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
    // console.warn("Could not close tab (maybe already closed):", e);
  }

  // Add to storage
  await addSnoozedTab(tab, popTimeObj, openInNewWindow, groupId);
}

export async function popCheck() {
  if (!navigator.onLine) {
    return 0;
  }

  const snoozedTabs = await getSnoozedTabs();

  if (!snoozedTabs) return 0;

  var timestamps = Object.keys(snoozedTabs).sort();
  var tabsToPop = [];
  var timesToRemove = [];

  var now = Date.now();

  for (var i = 0; i < timestamps.length; i++) {
    var timeStr = timestamps[i];
    if (timeStr === "tabCount") continue; // Skip counter key if present in keys

    var time = parseInt(timeStr); // keys are strings
    if (isNaN(time)) continue;

    if (time < now) {
      timesToRemove.push(timeStr);
      tabsToPop = tabsToPop.concat(snoozedTabs[timeStr]);
    }
  }

  if (tabsToPop.length > 0) {
    await restoreTabs(tabsToPop, timesToRemove);
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

  // Cleanup storage (Now protected by lock and re-verification)
  await storageLock.then(async () => {
    // Re-read storage inside the lock to get the latest state
    const currentSnoozedTabs = await getSnoozedTabs();
    if (!currentSnoozedTabs) return;

    let actuallyRemovedCount = 0;

    for (var i = 0; i < timesToRemove.length; i++) {
      const timeKey = timesToRemove[i];
      // Only delete if it still exists (it should)
      if (currentSnoozedTabs[timeKey]) {
        delete currentSnoozedTabs[timeKey];
        // We know exactly how many tabs were in this time slot from our local 'tabs' array
        // But better to count what we just removed to be safe, or stick to the logic:
        // We processed these specific time keys.
      }
    }

    // Recalculate or decrement count safely
    // Since we might have race conditions on tabCount if we just did -=,
    // let's trust that we are the only ones removing *these* specific timestamps.
    currentSnoozedTabs["tabCount"] = Math.max(
      0,
      (currentSnoozedTabs["tabCount"] || 0) - tabs.length
    );

    await setSnoozedTabs(currentSnoozedTabs);
  });
}

// Revised: Parallel creation
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
    // console.error(e);
  }
}

// Mutex for storage operations
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
      // console.error("Error in storage lock:", err);
    });

  return storageLock;
}

export async function restoreWindowGroup(groupId) {
  const snoozedTabs = await getSnoozedTabs();
  const timestamps = Object.keys(snoozedTabs);
  let groupTabs = [];

  // 1. Gather Tabs
  for (const ts of timestamps) {
    if (ts === "tabCount") continue;
    const tabs = snoozedTabs[ts];
    if (!Array.isArray(tabs)) continue;

    const matchingTabs = tabs.filter((t) => t.groupId === groupId);
    groupTabs = groupTabs.concat(matchingTabs);
  }

  if (groupTabs.length === 0) return;

  // 2. Sort by original tab index to preserve order
  groupTabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  // 3. Open in New Window
  const urls = groupTabs.map((t) => t.url);
  await chrome.windows.create({ url: urls, focused: true });

  // 3. Remove from storage
  await removeWindowGroup(groupId);
}

export async function removeSnoozedTabWrapper(tab) {
  const snoozedTabs = await getSnoozedTabs();
  await removeSnoozedTab(tab, snoozedTabs);
  // removeSnoozedTab modifies object, we need to save it.
  await setSnoozedTabs(snoozedTabs);
}

// Inner helper that modifies the object reference
async function removeSnoozedTab(tab, snoozedTabs) {
  // tab.popTime might be string or number
  var popTime = new Date(tab.popTime).getTime();
  var popSet = snoozedTabs[popTime];

  if (!popSet) return; // not found

  var tabIndex = -1;
  // creationTime is used as unique ID match
  var targetCreationTime = new Date(tab.creationTime).getTime();

  for (var i = 0; i < popSet.length; i++) {
    // Comparison of creation times
    // Note: storage JSON cycle might turn dates to strings, so safer to compare timestamps
    let itemTime = new Date(popSet[i].creationTime).getTime();

    if (itemTime === targetCreationTime) {
      tabIndex = i;
      break;
    }
  }

  if (tabIndex < 0) return;

  popSet.splice(tabIndex, 1);

  if (popSet.length == 0) {
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
