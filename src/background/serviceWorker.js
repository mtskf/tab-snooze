/**
 * Snooooze
 *
 * background.js (Manifest V3 Service Worker)
 * Athyuttam Reddy Eleti
 * @athyuttamre
 */

console.log("Service Worker initializing...");

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
    console.log("Extension installed/updated.");
    await initStorage();
    chrome.alarms.create("popCheck", { periodInMinutes: 1 });
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
                await snooze(request.tab, request.popTime, request.openInNewWindow);
                sendResponse({ success: true });
                break;
            case "removeSnoozedTab":
                await removeSnoozedTabWrapper(request.tab);
                sendResponse({ success: true });
                break;

            default:
                console.warn("Unknown message action:", request.action);
                sendResponse({ error: "Unknown action" });
        }
    } catch (error) {
        console.error("Error handling message:", error);
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
            "open-new-tab": "true",
            "badge": "true"
        };
        await setSettings(settings);
    }

    await chrome.action.setBadgeBackgroundColor({ color: "#FED23B" });
    await chrome.action.setBadgeBackgroundColor({ color: "#FED23B" });
}

// Logic Functions

async function snooze(tab, popTime, openInNewWindow) {
    // Note: tab is passed from popup, might not be full Tab object but has necessary props
    // popTime comes as string or timestamp from message usually

    // Ensure popTime is handled correctly (if passed as string over JSON)
    const popTimeObj = new Date(popTime);

    // Remove tab
    try {
        await chrome.tabs.remove(tab.id);
    } catch (e) {
        console.warn("Could not close tab (maybe already closed):", e);
    }

    // Add to storage
    await addSnoozedTab(tab, popTimeObj, openInNewWindow);
}

async function popCheck() {
    if (!navigator.onLine) {
        console.log("Offline, skipping popCheck.");
        return;
    }

    // Check if notifications are active to avoid overlap
    const notifications = await new Promise(resolve => chrome.notifications.getAll(resolve));
    if (Object.keys(notifications).length > 0) {
        console.log("Notifications active, skipping popCheck.");
        // Note: This logic is simple. It blocks if *any* notification is open.
        return;
    }

    const snoozedTabs = await getSnoozedTabs();

    if (!snoozedTabs) return;

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
        showNotification(tabsToPop, async (id) => {
            await chrome.storage.local.set({ pendingTabs: { tabs: tabsToPop, times: timesToRemove, notificationId: id } });
        });
    }
}

function showNotification(tabs, callback) {
    var tabCount = tabs.length;
    var message = "" + tabCount + ((tabCount > 1) ? " tabs are back" : " tab is back");

    chrome.notifications.create("", {
        type: "basic",
        priority: 1,
        title: "Snooooze",
        message: message,
        iconUrl: "assets/icons/browserAction.png", // path relative to root
        buttons: [{
            title: "Open Now"
        }, {
            title: "Postpone all but 50"
        }]
    }, function(id) {
        callback(id);
    });
}

// Global Notification Listeners
chrome.notifications.onClosed.addListener(async (nid, byUser) => {
    const data = await chrome.storage.local.get("pendingTabs");
    if (data.pendingTabs && data.pendingTabs.notificationId === nid) {
        // Re-snooze logic
        console.log("Notification closed. Re-snoozing for 1 hour.");
        const tabs = data.pendingTabs.tabs;
        for (const tab of tabs) {
             const popTime = new Date();
             popTime.setHours(popTime.getHours() + 1);
             await changeSnoozeTime(tab, popTime);
        }
        await chrome.storage.local.remove("pendingTabs");
    }
});

chrome.notifications.onButtonClicked.addListener(async (nid, buttonIndex) => {
    const data = await chrome.storage.local.get(["pendingTabs", "settings"]);
    if (data.pendingTabs && data.pendingTabs.notificationId === nid) {
        const tabs = data.pendingTabs.tabs;
        const times = data.pendingTabs.times;

        if (buttonIndex === 0) {
            // Open Now
            var settings = data.settings || {}; // Retrieve settings
            var openInNewTab = settings["open-new-tab"] === "true" || settings["open-new-tab"] === true; // Normalize boolean

            // If "open-new-tab" is TRUE, it implies opening in the current window (as new tabs).
            // If FALSE, it implies opening in a NEW window.
            // (Based on user request: "Open in New Tab" setting determines restore method).

            if (openInNewTab) {
                 const currentWindow = await chrome.windows.getCurrent();
                 await createTabsInWindow(tabs, currentWindow);
            } else {
                 const newWindow = await chrome.windows.create({});
                 await createTabsInWindow(tabs, newWindow);
            }

            // Cleanup storage
            const snoozedTabs = await getSnoozedTabs();
            for (var i = 0; i < times.length; i++) {
                delete snoozedTabs[times[i]];
            }
            snoozedTabs["tabCount"] = Math.max(0, snoozedTabs["tabCount"] - tabs.length);
            await setSnoozedTabs(snoozedTabs);

        } else if (buttonIndex === 1) {
            // Postpone
             console.log("Postponing...");
             for (const tab of tabs) {
                 const popTime = new Date();
                 popTime.setHours(popTime.getHours() + 1);
                 await changeSnoozeTime(tab, popTime);
             }
        }

        await chrome.storage.local.remove("pendingTabs");
        chrome.notifications.clear(nid);
    }
});

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
    } catch(e) { console.error(e); }
}

// Mutex for storage operations
let storageLock = Promise.resolve();

async function addSnoozedTab(tab, popTime, openInNewWindow) {
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
            openInNewWindow: !!openInNewWindow
        });

        snoozedTabs["tabCount"] = (snoozedTabs["tabCount"] || 0) + 1;

        await setSnoozedTabs(snoozedTabs);
    }).catch(err => {
        console.error("Error in storage lock:", err);
    });

    return storageLock;
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

        // fuzzy match or strict? Original was strict ==.
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

async function changeSnoozeTime(tab, newTime) {
    const snoozedTabs = await getSnoozedTabs();
    // Remove from old
    await removeSnoozedTab(tab, snoozedTabs);
    // Save state intermediate? No, we can just modify object and save once usually,
    // but addSnoozedTab re-reads.
    // So let's save the removal first.
    await setSnoozedTabs(snoozedTabs);

    // Add to new
    await addSnoozedTab(tab, newTime, tab.openInNewWindow); // Preserve flag if changing time
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
