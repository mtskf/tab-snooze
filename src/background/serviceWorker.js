/**
 * Snooooze
 * background.js (Manifest V3 Service Worker)
 */

import {
  initStorage,
  popCheck,
  snooze,
  removeSnoozedTabWrapper,
  removeWindowGroup,
  restoreWindowGroup,
  getSnoozedTabs,
  setSnoozedTabs,
  getSettings,
  setSettings,
  getValidatedSnoozedTabs,
} from "./snoozeLogic";

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  await initStorage();
  chrome.alarms.create("popCheck", { periodInMinutes: 1 });
  // Check for overdue tabs immediately
  setTimeout(() => popCheck(), 1000);
  // Check for pending recovery notification
  await checkPendingRecoveryNotification();
});

// Run popCheck on browser startup (for persistent overdue tabs)
chrome.runtime.onStartup.addListener(async () => {
  await initStorage();
  setTimeout(() => popCheck(), 1000);
  // Check for pending recovery notification
  await checkPendingRecoveryNotification();
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
      case "ensureSnoozedTabs":
        // Validate and recover if needed, return post-recovery payload
        sendResponse(await getValidatedSnoozedTabs());
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
        await snooze(
          request.tab,
          request.popTime,
          request.openInNewWindow,
          request.groupId
        );
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

/**
 * Check for pending recovery notification and show it (with deduplication)
 */
async function checkPendingRecoveryNotification() {
  try {
    // Check if there's a pending notification from initStorage
    const session = await chrome.storage.session.get(['pendingRecoveryNotification', 'lastRecoveryNotifiedAt']);

    if (session.pendingRecoveryNotification !== undefined) {
      const tabCount = session.pendingRecoveryNotification;
      const now = Date.now();
      const NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes

      // Check if we recently showed a notification
      if (!session.lastRecoveryNotifiedAt || (now - session.lastRecoveryNotifiedAt) > NOTIFICATION_COOLDOWN) {
        // Show notification
        await chrome.notifications.create('recovery-notification', {
          type: 'basic',
          iconUrl: 'assets/icon128.png',
          title: 'Snooooze Data Recovered',
          message: tabCount > 0
            ? `Recovered ${tabCount} snoozed tab${tabCount > 1 ? 's' : ''} from backup.`
            : 'Snoozed tabs data was reset due to corruption.',
          priority: 1
        });

        // Update timestamp
        await chrome.storage.session.set({ lastRecoveryNotifiedAt: now });
      }

      // Clear the pending flag
      await chrome.storage.session.remove('pendingRecoveryNotification');
    }
  } catch (e) {
    // Notification failed, but don't crash
    console.warn('Recovery notification failed:', e);
  }
}

// Notification click handler - open Options page
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === 'storage-warning' || notificationId === 'recovery-notification') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options/index.html') });
  }
});
