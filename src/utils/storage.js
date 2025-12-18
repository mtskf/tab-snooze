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
