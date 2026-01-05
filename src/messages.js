/**
 * Message Passing Contracts
 *
 * Centralizes all message action types, request/response validation,
 * and handler mappings for chrome.runtime messaging.
 *
 * @typedef {import('./types.js').MessageRequest} MessageRequest
 * @typedef {import('./types.js').MessageResponse} MessageResponse
 * @typedef {import('./types.js').GetSnoozedTabsRequest} GetSnoozedTabsRequest
 * @typedef {import('./types.js').SetSnoozedTabsRequest} SetSnoozedTabsRequest
 * @typedef {import('./types.js').GetSettingsRequest} GetSettingsRequest
 * @typedef {import('./types.js').SetSettingsRequest} SetSettingsRequest
 * @typedef {import('./types.js').SnoozeRequest} SnoozeRequest
 * @typedef {import('./types.js').RemoveSnoozedTabRequest} RemoveSnoozedTabRequest
 * @typedef {import('./types.js').RemoveWindowGroupRequest} RemoveWindowGroupRequest
 * @typedef {import('./types.js').RestoreWindowGroupRequest} RestoreWindowGroupRequest
 * @typedef {import('./types.js').ClearAllSnoozedTabsRequest} ClearAllSnoozedTabsRequest
 */

/**
 * Message action constants
 * Centralized source of truth for all message action types
 */
export const MESSAGE_ACTIONS = {
  GET_SNOOZED_TABS: 'getSnoozedTabs',
  GET_SNOOZED_TABS_V2: 'getSnoozedTabsV2',
  SET_SNOOZED_TABS: 'setSnoozedTabs',
  GET_SETTINGS: 'getSettings',
  SET_SETTINGS: 'setSettings',
  SNOOZE: 'snooze',
  REMOVE_SNOOZED_TAB: 'removeSnoozedTab',
  CLEAR_ALL_SNOOZED_TABS: 'clearAllSnoozedTabs',
  REMOVE_WINDOW_GROUP: 'removeWindowGroup',
  RESTORE_WINDOW_GROUP: 'restoreWindowGroup',
  IMPORT_TABS: 'importTabs',
  EXPORT_TABS: 'exportTabs',
};

/**
 * Validates a message request structure
 * @param {any} request - Request to validate
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export function validateMessageRequest(request) {
  const errors = [];

  if (!request || typeof request !== 'object') {
    return { valid: false, errors: ['Request must be an object'] };
  }

  if (!request.action || typeof request.action !== 'string') {
    errors.push('Request must have an action property of type string');
  }

  const validActions = Object.values(MESSAGE_ACTIONS);
  if (request.action && !validActions.includes(request.action)) {
    errors.push(`Unknown action: ${request.action}`);
  }

  // Action-specific validation
  switch (request.action) {
    case MESSAGE_ACTIONS.SET_SNOOZED_TABS:
      if (!request.data) {
        errors.push('setSnoozedTabs requires data property');
      }
      break;

    case MESSAGE_ACTIONS.SET_SETTINGS:
      if (!request.data || typeof request.data !== 'object') {
        errors.push('setSettings requires data object');
      }
      break;

    case MESSAGE_ACTIONS.SNOOZE:
      if (!request.tab) {
        errors.push('snooze requires tab property');
      }
      if (typeof request.popTime !== 'number') {
        errors.push('snooze requires popTime (number)');
      }
      break;

    case MESSAGE_ACTIONS.REMOVE_SNOOZED_TAB:
      if (!request.tab) {
        errors.push('removeSnoozedTab requires tab property');
      }
      break;

    case MESSAGE_ACTIONS.REMOVE_WINDOW_GROUP:
      if (!request.groupId || typeof request.groupId !== 'string') {
        errors.push('removeWindowGroup requires groupId (string)');
      }
      break;

    case MESSAGE_ACTIONS.RESTORE_WINDOW_GROUP:
      if (!request.groupId || typeof request.groupId !== 'string') {
        errors.push('restoreWindowGroup requires groupId (string)');
      }
      break;

    case MESSAGE_ACTIONS.IMPORT_TABS:
      if (!request.data || typeof request.data !== 'object') {
        errors.push('importTabs requires data object');
      }
      break;

    // These actions require no additional properties
    case MESSAGE_ACTIONS.GET_SNOOZED_TABS:
    case MESSAGE_ACTIONS.GET_SNOOZED_TABS_V2:
    case MESSAGE_ACTIONS.GET_SETTINGS:
    case MESSAGE_ACTIONS.CLEAR_ALL_SNOOZED_TABS:
    case MESSAGE_ACTIONS.EXPORT_TABS:
      break;
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Creates a validated message request
 * @param {string} action - Action type from MESSAGE_ACTIONS
 * @param {Object} [payload] - Optional payload data
 * @returns {MessageRequest} Validated message request
 * @throws {Error} If validation fails
 */
export function createMessage(action, payload = {}) {
  const request = { action, ...payload };
  const validation = validateMessageRequest(request);

  if (!validation.valid) {
    throw new Error(`Invalid message: ${validation.errors.join(', ')}`);
  }

  return request;
}

/**
 * Message handler registry
 * Maps action types to their handler functions
 *
 * Handler signature: async (request, services) => response
 * - request: The full message request object
 * - services: Injected services (snoozeLogic functions, etc.)
 * - returns: MessageResponse
 */
export const MESSAGE_HANDLERS = {
  [MESSAGE_ACTIONS.GET_SNOOZED_TABS]: async (request, { getValidatedSnoozedTabs }) => {
    return await getValidatedSnoozedTabs();
  },

  [MESSAGE_ACTIONS.GET_SNOOZED_TABS_V2]: async (request, { getSnoozedTabsV2 }) => {
    return await getSnoozedTabsV2();
  },

  [MESSAGE_ACTIONS.SET_SNOOZED_TABS]: async (request, { setSnoozedTabs }) => {
    await setSnoozedTabs(request.data);
    return { success: true };
  },

  [MESSAGE_ACTIONS.GET_SETTINGS]: async (request, { getSettings }) => {
    return await getSettings();
  },

  [MESSAGE_ACTIONS.SET_SETTINGS]: async (request, { setSettings }) => {
    await setSettings(request.data);
    return { success: true };
  },

  [MESSAGE_ACTIONS.SNOOZE]: async (request, { snooze }) => {
    await snooze(request.tab, request.popTime, request.groupId);
    return { success: true };
  },

  [MESSAGE_ACTIONS.REMOVE_SNOOZED_TAB]: async (request, { removeSnoozedTabWrapper }) => {
    await removeSnoozedTabWrapper(request.tab);
    return { success: true };
  },

  [MESSAGE_ACTIONS.CLEAR_ALL_SNOOZED_TABS]: async (request, { setSnoozedTabs }) => {
    await setSnoozedTabs({ tabCount: 0 });
    return { success: true };
  },

  [MESSAGE_ACTIONS.REMOVE_WINDOW_GROUP]: async (request, { removeWindowGroup }) => {
    await removeWindowGroup(request.groupId);
    return { success: true };
  },

  [MESSAGE_ACTIONS.RESTORE_WINDOW_GROUP]: async (request, { restoreWindowGroup }) => {
    await restoreWindowGroup(request.groupId);
    return { success: true };
  },

  [MESSAGE_ACTIONS.IMPORT_TABS]: async (request, { importTabs }) => {
    return await importTabs(request.data);
  },

  [MESSAGE_ACTIONS.EXPORT_TABS]: async (request, { getExportData }) => {
    return await getExportData();
  },
};

/**
 * Dispatches a message to the appropriate handler
 * @param {MessageRequest} request - Message request
 * @param {Object} services - Service dependencies (snoozeLogic functions)
 * @returns {Promise<MessageResponse>} Response from handler
 * @throws {Error} If handler not found or validation fails
 */
export async function dispatchMessage(request, services) {
  // Validate request
  const validation = validateMessageRequest(request);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  // Get handler
  const handler = MESSAGE_HANDLERS[request.action];
  if (!handler) {
    throw new Error(`No handler registered for action: ${request.action}`);
  }

  // Execute handler
  return await handler(request, services);
}

/**
 * Helper to send a message and handle response
 * @param {string} action - Action from MESSAGE_ACTIONS
 * @param {Object} [payload] - Message payload
 * @returns {Promise<MessageResponse>} Response from background
 */
export function sendMessage(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const message = createMessage(action, payload);

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (response && response.error) {
        reject(new Error(response.error));
        return;
      }

      resolve(response);
    });
  });
}
