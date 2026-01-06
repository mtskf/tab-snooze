/**
 * Chrome API Wrapper
 *
 * Centralizes all chrome.* API calls with:
 * - Consistent error handling
 * - Testable interface (easy to mock)
 * - Type safety with TypeScript
 * - Graceful fallbacks for unsupported APIs (e.g., Firefox)
 */

import type { NotificationOptions } from '../types';

/**
 * Storage API wrapper
 */
export const storage = {
  /**
   * Gets data from chrome.storage.local
   */
  async getLocal(keys: string | string[] | null): Promise<Record<string, unknown>> {
    try {
      return await chrome.storage.local.get(keys);
    } catch (error) {
      console.error('Storage.getLocal failed:', error);
      throw new Error(`Failed to read from storage: ${(error as Error).message}`);
    }
  },

  /**
   * Sets data in chrome.storage.local
   */
  async setLocal(items: Record<string, unknown>): Promise<void> {
    try {
      await chrome.storage.local.set(items);
    } catch (error) {
      console.error('Storage.setLocal failed:', error);
      throw new Error(`Failed to write to storage: ${(error as Error).message}`);
    }
  },

  /**
   * Removes keys from chrome.storage.local
   */
  async removeLocal(keys: string | string[]): Promise<void> {
    try {
      await chrome.storage.local.remove(keys);
    } catch (error) {
      console.error('Storage.removeLocal failed:', error);
      throw new Error(`Failed to remove from storage: ${(error as Error).message}`);
    }
  },

  /**
   * Gets storage size in bytes (returns 0 if unsupported)
   */
  async getBytesInUse(keys: string[] | null): Promise<number> {
    try {
      if (typeof chrome.storage.local.getBytesInUse !== 'function') {
        return 0; // Unsupported (e.g., Firefox)
      }
      return await chrome.storage.local.getBytesInUse(keys);
    } catch (error) {
      console.warn('Storage.getBytesInUse failed:', error);
      return 0;
    }
  },

  /**
   * Gets data from chrome.storage.session (fallback to empty object if unsupported)
   */
  async getSession(keys: string | string[] | null): Promise<Record<string, unknown>> {
    try {
      if (!chrome.storage.session) {
        return {}; // Firefox doesn't support session storage
      }
      return await chrome.storage.session.get(keys);
    } catch (error) {
      console.warn('Storage.getSession failed:', error);
      return {};
    }
  },

  /**
   * Sets data in chrome.storage.session (no-op if unsupported)
   */
  async setSession(items: Record<string, unknown>): Promise<void> {
    try {
      if (!chrome.storage.session) {
        return; // Firefox doesn't support session storage
      }
      await chrome.storage.session.set(items);
    } catch (error) {
      console.warn('Storage.setSession failed:', error);
    }
  },

  /**
   * Removes keys from chrome.storage.session (no-op if unsupported)
   */
  async removeSession(keys: string | string[]): Promise<void> {
    try {
      if (!chrome.storage.session) {
        return;
      }
      await chrome.storage.session.remove(keys);
    } catch (error) {
      console.warn('Storage.removeSession failed:', error);
    }
  },
};

/**
 * Tabs API wrapper
 */
export const tabs = {
  /**
   * Queries for tabs matching criteria
   */
  async query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
    try {
      return await chrome.tabs.query(queryInfo);
    } catch (error) {
      console.error('Tabs.query failed:', error);
      throw new Error(`Failed to query tabs: ${(error as Error).message}`);
    }
  },

  /**
   * Creates a new tab
   */
  async create(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
    try {
      return await chrome.tabs.create(createProperties);
    } catch (error) {
      console.error('Tabs.create failed:', error);
      throw new Error(`Failed to create tab: ${(error as Error).message}`);
    }
  },

  /**
   * Removes (closes) tabs
   */
  async remove(tabIds: number | number[]): Promise<void> {
    try {
      await chrome.tabs.remove(tabIds);
    } catch (error) {
      console.error('Tabs.remove failed:', error);
      throw new Error(`Failed to remove tabs: ${(error as Error).message}`);
    }
  },

  /**
   * Updates tab properties
   */
  async update(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab> {
    try {
      const tab = await chrome.tabs.update(tabId, updateProperties);
      if (!tab) {
        throw new Error('Tab not found');
      }
      return tab;
    } catch (error) {
      console.error('Tabs.update failed:', error);
      throw new Error(`Failed to update tab: ${(error as Error).message}`);
    }
  },
};

/**
 * Windows API wrapper
 */
export const windows = {
  /**
   * Creates a new window
   */
  async create(createData?: chrome.windows.CreateData): Promise<chrome.windows.Window | undefined> {
    try {
      return await chrome.windows.create(createData);
    } catch (error) {
      console.error('Windows.create failed:', error);
      throw new Error(`Failed to create window: ${(error as Error).message}`);
    }
  },

  /**
   * Gets information about a window
   */
  async get(windowId: number, getInfo?: chrome.windows.QueryOptions): Promise<chrome.windows.Window> {
    try {
      return await chrome.windows.get(windowId, getInfo);
    } catch (error) {
      console.error('Windows.get failed:', error);
      throw new Error(`Failed to get window: ${(error as Error).message}`);
    }
  },

  /**
   * Gets the last focused window
   */
  async getLastFocused(getInfo?: chrome.windows.QueryOptions): Promise<chrome.windows.Window> {
    try {
      return await chrome.windows.getLastFocused(getInfo);
    } catch (error) {
      console.error('Windows.getLastFocused failed:', error);
      throw new Error(`Failed to get last focused window: ${(error as Error).message}`);
    }
  },

  /**
   * Removes (closes) a window
   */
  async remove(windowId: number): Promise<void> {
    try {
      await chrome.windows.remove(windowId);
    } catch (error) {
      console.error('Windows.remove failed:', error);
      throw new Error(`Failed to remove window: ${(error as Error).message}`);
    }
  },
};

/**
 * Notifications API wrapper
 */
export const notifications = {
  /**
   * Creates a notification
   */
  async create(notificationId: string, options: NotificationOptions): Promise<string> {
    try {
      return await chrome.notifications.create(notificationId, options as chrome.notifications.NotificationOptions);
    } catch (error) {
      console.error('Notifications.create failed:', error);
      throw new Error(`Failed to create notification: ${(error as Error).message}`);
    }
  },

  /**
   * Clears a notification
   */
  async clear(notificationId: string): Promise<boolean> {
    try {
      return await chrome.notifications.clear(notificationId);
    } catch (error) {
      console.warn('Notifications.clear failed:', error);
      return false;
    }
  },
};

/**
 * Alarms API wrapper
 */
export const alarms = {
  /**
   * Creates an alarm
   */
  async create(name: string, alarmInfo: chrome.alarms.AlarmCreateInfo): Promise<void> {
    try {
      await chrome.alarms.create(name, alarmInfo);
    } catch (error) {
      console.error('Alarms.create failed:', error);
      throw new Error(`Failed to create alarm: ${(error as Error).message}`);
    }
  },

  /**
   * Clears an alarm
   */
  async clear(name?: string): Promise<boolean> {
    try {
      return await chrome.alarms.clear(name);
    } catch (error) {
      console.warn('Alarms.clear failed:', error);
      return false;
    }
  },

  /**
   * Gets an alarm
   */
  async get(name?: string): Promise<chrome.alarms.Alarm | undefined> {
    try {
      return await chrome.alarms.get(name);
    } catch (error) {
      console.warn('Alarms.get failed:', error);
      return undefined;
    }
  },
};

/**
 * Runtime API wrapper
 */
export const runtime = {
  /**
   * Gets the URL for a resource
   */
  getURL(path: string): string {
    try {
      return chrome.runtime.getURL(path);
    } catch (error) {
      console.error('Runtime.getURL failed:', error);
      return '';
    }
  },

  /**
   * Opens the extension's options page
   */
  async openOptionsPage(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.runtime.openOptionsPage(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  },
};

/**
 * Commands API wrapper
 */
export const commands = {
  /**
   * Gets all extension commands with shortcuts
   */
  async getAll(): Promise<chrome.commands.Command[]> {
    return new Promise((resolve, reject) => {
      chrome.commands.getAll((cmds: chrome.commands.Command[]) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(cmds);
      });
    });
  },
};

/**
 * Combined API object for easy importing
 */
export const ChromeApi = {
  storage,
  tabs,
  windows,
  notifications,
  alarms,
  runtime,
  commands,
};

export default ChromeApi;
