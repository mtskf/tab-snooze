/**
 * Chrome API Wrapper
 *
 * Centralizes all chrome.* API calls with:
 * - Consistent error handling
 * - Testable interface (easy to mock)
 * - Type safety with JSDoc
 * - Graceful fallbacks for unsupported APIs (e.g., Firefox)
 */

/**
 * @typedef {import('../types.js').ChromeTab} ChromeTab
 * @typedef {import('../types.js').NotificationOptions} NotificationOptions
 */

/**
 * Storage API wrapper
 */
export const storage = {
  /**
   * Gets data from chrome.storage.local
   * @param {string|string[]|null} keys - Keys to retrieve (null for all)
   * @returns {Promise<Object>} Storage data
   */
  async getLocal(keys) {
    try {
      return await chrome.storage.local.get(keys);
    } catch (error) {
      console.error('Storage.getLocal failed:', error);
      throw new Error(`Failed to read from storage: ${error.message}`);
    }
  },

  /**
   * Sets data in chrome.storage.local
   * @param {Object} items - Key-value pairs to store
   * @returns {Promise<void>}
   */
  async setLocal(items) {
    try {
      await chrome.storage.local.set(items);
    } catch (error) {
      console.error('Storage.setLocal failed:', error);
      throw new Error(`Failed to write to storage: ${error.message}`);
    }
  },

  /**
   * Removes keys from chrome.storage.local
   * @param {string|string[]} keys - Keys to remove
   * @returns {Promise<void>}
   */
  async removeLocal(keys) {
    try {
      await chrome.storage.local.remove(keys);
    } catch (error) {
      console.error('Storage.removeLocal failed:', error);
      throw new Error(`Failed to remove from storage: ${error.message}`);
    }
  },

  /**
   * Gets storage size in bytes (returns 0 if unsupported)
   * @param {string[]|null} keys - Keys to check size for
   * @returns {Promise<number>} Bytes used
   */
  async getBytesInUse(keys) {
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
   * @param {string|string[]|null} keys - Keys to retrieve
   * @returns {Promise<Object>} Session storage data
   */
  async getSession(keys) {
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
   * @param {Object} items - Key-value pairs to store
   * @returns {Promise<void>}
   */
  async setSession(items) {
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
   * @param {string|string[]} keys - Keys to remove
   * @returns {Promise<void>}
   */
  async removeSession(keys) {
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
   * @param {Object} queryInfo - Query criteria
   * @returns {Promise<ChromeTab[]>} Matching tabs
   */
  async query(queryInfo) {
    try {
      return await chrome.tabs.query(queryInfo);
    } catch (error) {
      console.error('Tabs.query failed:', error);
      throw new Error(`Failed to query tabs: ${error.message}`);
    }
  },

  /**
   * Creates a new tab
   * @param {Object} createProperties - Tab properties
   * @returns {Promise<ChromeTab>} Created tab
   */
  async create(createProperties) {
    try {
      return await chrome.tabs.create(createProperties);
    } catch (error) {
      console.error('Tabs.create failed:', error);
      throw new Error(`Failed to create tab: ${error.message}`);
    }
  },

  /**
   * Removes (closes) tabs
   * @param {number|number[]} tabIds - Tab ID(s) to remove
   * @returns {Promise<void>}
   */
  async remove(tabIds) {
    try {
      await chrome.tabs.remove(tabIds);
    } catch (error) {
      console.error('Tabs.remove failed:', error);
      throw new Error(`Failed to remove tabs: ${error.message}`);
    }
  },

  /**
   * Updates tab properties
   * @param {number} tabId - Tab ID
   * @param {Object} updateProperties - Properties to update
   * @returns {Promise<ChromeTab>} Updated tab
   */
  async update(tabId, updateProperties) {
    try {
      return await chrome.tabs.update(tabId, updateProperties);
    } catch (error) {
      console.error('Tabs.update failed:', error);
      throw new Error(`Failed to update tab: ${error.message}`);
    }
  },
};

/**
 * Windows API wrapper
 */
export const windows = {
  /**
   * Creates a new window
   * @param {Object} createData - Window properties
   * @returns {Promise<Object>} Created window
   */
  async create(createData) {
    try {
      return await chrome.windows.create(createData);
    } catch (error) {
      console.error('Windows.create failed:', error);
      throw new Error(`Failed to create window: ${error.message}`);
    }
  },

  /**
   * Gets information about a window
   * @param {number} windowId - Window ID
   * @param {Object} [getInfo] - Optional query info
   * @returns {Promise<Object>} Window info
   */
  async get(windowId, getInfo) {
    try {
      return await chrome.windows.get(windowId, getInfo);
    } catch (error) {
      console.error('Windows.get failed:', error);
      throw new Error(`Failed to get window: ${error.message}`);
    }
  },
};

/**
 * Notifications API wrapper
 */
export const notifications = {
  /**
   * Creates a notification
   * @param {string} notificationId - Notification ID
   * @param {NotificationOptions} options - Notification options
   * @returns {Promise<string>} Notification ID
   */
  async create(notificationId, options) {
    try {
      return await chrome.notifications.create(notificationId, options);
    } catch (error) {
      console.error('Notifications.create failed:', error);
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  },

  /**
   * Clears a notification
   * @param {string} notificationId - Notification ID
   * @returns {Promise<boolean>} Whether notification was cleared
   */
  async clear(notificationId) {
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
   * @param {string} name - Alarm name
   * @param {Object} alarmInfo - Alarm configuration
   * @returns {Promise<void>}
   */
  async create(name, alarmInfo) {
    try {
      await chrome.alarms.create(name, alarmInfo);
    } catch (error) {
      console.error('Alarms.create failed:', error);
      throw new Error(`Failed to create alarm: ${error.message}`);
    }
  },

  /**
   * Clears an alarm
   * @param {string} [name] - Alarm name (clears all if omitted)
   * @returns {Promise<boolean>} Whether alarm was cleared
   */
  async clear(name) {
    try {
      return await chrome.alarms.clear(name);
    } catch (error) {
      console.warn('Alarms.clear failed:', error);
      return false;
    }
  },

  /**
   * Gets an alarm
   * @param {string} [name] - Alarm name
   * @returns {Promise<Object|undefined>} Alarm or undefined
   */
  async get(name) {
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
   * Sends a message to the background script
   * @param {Object} message - Message to send
   * @returns {Promise<any>} Response from background
   */
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  },

  /**
   * Gets the URL for a resource
   * @param {string} path - Resource path
   * @returns {string} Full URL
   */
  getURL(path) {
    try {
      return chrome.runtime.getURL(path);
    } catch (error) {
      console.error('Runtime.getURL failed:', error);
      return '';
    }
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
};

export default ChromeApi;
