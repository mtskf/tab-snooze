// Promise-based overloads for Chrome API
// @types/chrome defines callback-based signatures, but MV3 supports Promises
// These overloads add Promise return types to coexist with existing callback signatures
//
// MAINTENANCE: If @types/chrome adds Promise signatures in a future version,
// `tsc --noEmit` may fail with "Duplicate identifier" errors.
// In that case, remove the conflicting declarations from this file.

declare namespace chrome.storage {
  // Extend StorageArea interface with Promise-returning overloads
  // SessionStorageArea and LocalStorageArea inherit these automatically
  interface StorageArea {
    get(keys?: string | string[] | null): Promise<{ [key: string]: unknown }>;
    set(items: { [key: string]: unknown }): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
    getBytesInUse(keys?: string | string[] | null): Promise<number>;
  }
}

declare namespace chrome.tabs {
  function create(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab>;
  function remove(tabIds: number | number[]): Promise<void>;
  function query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
  function update(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab>;
}

declare namespace chrome.windows {
  function create(createData?: chrome.windows.CreateData): Promise<chrome.windows.Window>;
  function getAll(getInfo?: chrome.windows.GetInfo): Promise<chrome.windows.Window[]>;
  function get(windowId: number, getInfo?: chrome.windows.GetInfo): Promise<chrome.windows.Window>;
  function getLastFocused(getInfo?: chrome.windows.GetInfo): Promise<chrome.windows.Window>;
  function remove(windowId: number): Promise<void>;
}

declare namespace chrome.notifications {
  function create(notificationId: string, options: chrome.notifications.NotificationOptions): Promise<string>;
  function clear(notificationId: string): Promise<boolean>;
}

declare namespace chrome.alarms {
  function create(name: string, alarmInfo: chrome.alarms.AlarmCreateInfo): Promise<void>;
  function clear(name?: string): Promise<boolean>;
  function clearAll(): Promise<boolean>;
  function get(name: string): Promise<chrome.alarms.Alarm | undefined>;
  function getAll(): Promise<chrome.alarms.Alarm[]>;
}

declare namespace chrome.runtime {
  function sendMessage<T = unknown>(message: unknown): Promise<T>;
  function openOptionsPage(): Promise<void>;
}

declare namespace chrome.commands {
  function getAll(): Promise<chrome.commands.Command[]>;
}
