/**
 * Snooooze
 * background.js (Manifest V3 Service Worker)
 */

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
    await initStorage();
    chrome.alarms.create("popCheck", { periodInMinutes: 1 });
    // Check for overdue tabs immediately
    setTimeout(() => popCheck(), 1000);
});

// Run popCheck on browser startup (for persistent overdue tabs)
chrome.runtime.onStartup.addListener(() => {
    setTimeout(() => popCheck(), 1000);
});

// Alarm listener for periodic checks
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "popCheck") {
        popCheck();
    }
});

// Message listener for communication with Popup/Options
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sendResponse);
    return true; // Indicates async response
});

async function handleMessage(request, sendResponse) {
    try {
        switch (request.action) {
            case "getSnoozedTabs":
                sendResponse(await getSnoozedTabs());
                break;
            case "setSnoozedTabs":
                await setSnoozedTabs(request.data);
                sendResponse({ success: true });
                break;
            case "getSettings":
                sendResponse(await getSettings());
                break;
            case "setSettings":
                await setSettings(request.data);
                sendResponse({ success: true });
                break;
            case "snooze":
                await snooze(request.tab, request.popTime, request.openInNewWindow, request.groupId);
                sendResponse({ success: true });
                break;
            case "removeSnoozedTab":
                await removeSnoozedTabWrapper(request.tab);
                sendResponse({ success: true });
                break;
            case "clearAllSnoozedTabs":
                await setSnoozedTabs({ tabCount: 0 });
                sendResponse({ success: true });
                break;
            case "removeWindowGroup":
                await removeWindowGroup(request.groupId);
                sendResponse({ success: true });
                break;
            case "restoreWindowGroup":
                await restoreWindowGroup(request.groupId);
                sendResponse({ success: true });
                break;


            default:
                // console.warn("Unknown message action:", request.action);
                sendResponse({ error: "Unknown action" });
        }
    } catch (error) {
        // console.error("Error handling message:", error);
        sendResponse({ error: error.message });
    }
}

async function initStorage() {
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
            "someday": 3,
            "badge": "true"
        };
        await setSettings(settings);
    }

    await chrome.action.setBadgeBackgroundColor({ color: "#FED23B" });
    await chrome.action.setBadgeBackgroundColor({ color: "#FED23B" });
}

// Logic Functions

async function snooze(tab, popTime, openInNewWindow, groupId = null) {
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

async function popCheck() {
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
    var settings = await getSettings(); // Retrieve latest settings

    // Group by groupId
    const groups = {};
    const ungrouped = [];

    tabs.forEach(tab => {
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
            const newWindow = await chrome.windows.create({});
            await createTabsInWindow(groupTabs, newWindow);
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
    const snoozedTabs = await getSnoozedTabs();
    if (snoozedTabs) {
        for (var i = 0; i < timesToRemove.length; i++) {
            delete snoozedTabs[timesToRemove[i]];
        }
        snoozedTabs["tabCount"] = Math.max(0, snoozedTabs["tabCount"] - tabs.length);
        await setSnoozedTabs(snoozedTabs);
    }
}

async function createTabsInWindow(tabs, w) {
    for (var i = 0; i < tabs.length; i++) {
        await createTab(tabs[i], w);
    }
}

async function createTab(tab, w) {
    try {
        await chrome.tabs.create({
            windowId: w.id,
            url: tab.url,
            active: false
        });
    } catch(e) {
        // console.error(e);
    }
}

// Mutex for storage operations
let storageLock = Promise.resolve();

async function addSnoozedTab(tab, popTime, openInNewWindow, groupId = null) {
    // Wrap the logic in the lock
    storageLock = storageLock.then(async () => {
        const snoozedTabs = await getSnoozedTabs();
        const fullTime = popTime.getTime();

        if (!snoozedTabs[fullTime]) {
            snoozedTabs[fullTime] = [];
        }

        snoozedTabs[fullTime].push({
            url: tab.url,
            title: tab.title,
            favicon: tab.favIconUrl || tab.favicon,
            creationTime: (new Date()).getTime(),
            popTime: popTime.getTime(),
            openInNewWindow: !!openInNewWindow,
            groupId: groupId
        });

        snoozedTabs["tabCount"] = (snoozedTabs["tabCount"] || 0) + 1;

        await setSnoozedTabs(snoozedTabs);
    }).catch(err => {
        // console.error("Error in storage lock:", err);
    });

    return storageLock;
}



async function restoreWindowGroup(groupId) {
    const snoozedTabs = await getSnoozedTabs();
    const timestamps = Object.keys(snoozedTabs);
    let groupTabs = [];

    // 1. Gather Tabs
    for (const ts of timestamps) {
        if (ts === 'tabCount') continue;
        const tabs = snoozedTabs[ts];
        if (!Array.isArray(tabs)) continue;

        const matchingTabs = tabs.filter(t => t.groupId === groupId);
        groupTabs = groupTabs.concat(matchingTabs);
    }

    if (groupTabs.length === 0) return;

    // 2. Open in New Window
    const newWindow = await chrome.windows.create({});
    await createTabsInWindow(groupTabs, newWindow);

    // 3. Remove from storage
    await removeWindowGroup(groupId);
}

async function removeSnoozedTabWrapper(tab) {
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

async function removeWindowGroup(groupId) {
    const snoozedTabs = await getSnoozedTabs();
    const timestamps = Object.keys(snoozedTabs);
    let removedCount = 0;

    for (const ts of timestamps) {
        if (ts === 'tabCount') continue;
        const tabs = snoozedTabs[ts];
        if (!Array.isArray(tabs)) continue;

        const originalLength = tabs.length;
        // Filter out tabs with the matching groupId
        const newTabs = tabs.filter(t => t.groupId !== groupId);

        if (newTabs.length !== originalLength) {
            removedCount += (originalLength - newTabs.length);
            if (newTabs.length === 0) {
                delete snoozedTabs[ts];
            } else {
                snoozedTabs[ts] = newTabs;
            }
        }
    }

    snoozedTabs["tabCount"] = Math.max(0, (snoozedTabs["tabCount"] || 0) - removedCount);
    await setSnoozedTabs(snoozedTabs);
}

// Storage Wrappers
async function getSnoozedTabs() {
    const res = await chrome.storage.local.get("snoozedTabs");
    return res.snoozedTabs;
}

async function setSnoozedTabs(val) {
    await chrome.storage.local.set({ snoozedTabs: val });
}

async function getSettings() {
    const res = await chrome.storage.local.get("settings");
    return res.settings;
}

async function setSettings(val) {
    await chrome.storage.local.set({ settings: val });
}
