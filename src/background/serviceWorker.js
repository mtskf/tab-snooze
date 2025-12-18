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
} from "./snoozeLogic";
import {
  getSnoozedTabs,
  setSnoozedTabs,
  getSettings,
  setSettings,
} from "../utils/storage";

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
