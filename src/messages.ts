/**
 * Message Passing Contracts
 *
 * Centralizes all message action types, request/response validation,
 * and handler mappings for chrome.runtime messaging.
 */

// Local type definitions (will be replaced with imports from types.ts after Phase 2 merge)
// TODO: Replace with `import type { ... } from './types'` after Phase 2 is merged

export interface SnoozedItemV2 {
  id: string;
  url: string;
  title?: string;
  favicon?: string | null;
  creationTime: number;
  popTime: number;
  groupId?: string | null;
  index?: number;
}

export interface StorageV2 {
  version: 2;
  items: Record<string, SnoozedItemV2>;
  schedule: Record<string, string[]>;
}

export interface Settings {
  'start-day': string;
  'end-day': string;
  'week-begin': number;
  'weekend-begin': number;
  timezone?: string;
  shortcuts?: Record<string, string[]>;
  appearance?: 'default' | 'vivid' | 'heatmap';
}

export interface SuccessResponse {
  success: boolean;
}

export interface ErrorResponse {
  error: string;
}

export interface ImportTabsResponse {
  success: boolean;
  addedCount?: number;
  error?: string;
}

export type MessageResponse = StorageV2 | Settings | SuccessResponse | ErrorResponse | ImportTabsResponse;

export interface MessageRequest {
  action: string;
  [key: string]: unknown;
}

/**
 * Message action constants
 * Centralized source of truth for all message action types
 */
export const MESSAGE_ACTIONS = {
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
} as const;

export type MessageAction = typeof MESSAGE_ACTIONS[keyof typeof MESSAGE_ACTIONS];

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a message request structure
 */
export function validateMessageRequest(request: unknown): ValidationResult {
  const errors: string[] = [];

  if (!request || typeof request !== 'object') {
    return { valid: false, errors: ['Request must be an object'] };
  }

  const req = request as Record<string, unknown>;

  if (!req.action || typeof req.action !== 'string') {
    errors.push('Request must have an action property of type string');
  }

  const validActions = Object.values(MESSAGE_ACTIONS) as string[];
  if (req.action && !validActions.includes(req.action as string)) {
    errors.push(`Unknown action: ${req.action}`);
  }

  // Action-specific validation
  switch (req.action) {
    case MESSAGE_ACTIONS.SET_SNOOZED_TABS:
      if (!req.data) {
        errors.push('setSnoozedTabs requires data property');
      }
      break;

    case MESSAGE_ACTIONS.SET_SETTINGS:
      if (!req.data || typeof req.data !== 'object') {
        errors.push('setSettings requires data object');
      }
      break;

    case MESSAGE_ACTIONS.SNOOZE:
      if (!req.tab) {
        errors.push('snooze requires tab property');
      }
      if (typeof req.popTime !== 'number') {
        errors.push('snooze requires popTime (number)');
      }
      break;

    case MESSAGE_ACTIONS.REMOVE_SNOOZED_TAB:
      if (!req.tab) {
        errors.push('removeSnoozedTab requires tab property');
      }
      break;

    case MESSAGE_ACTIONS.REMOVE_WINDOW_GROUP:
      if (!req.groupId || typeof req.groupId !== 'string') {
        errors.push('removeWindowGroup requires groupId (string)');
      }
      break;

    case MESSAGE_ACTIONS.RESTORE_WINDOW_GROUP:
      if (!req.groupId || typeof req.groupId !== 'string') {
        errors.push('restoreWindowGroup requires groupId (string)');
      }
      break;

    case MESSAGE_ACTIONS.IMPORT_TABS:
      if (!req.data || typeof req.data !== 'object') {
        errors.push('importTabs requires data object');
      }
      break;

    // These actions require no additional properties
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
 */
export function createMessage(action: MessageAction, payload: Record<string, unknown> = {}): MessageRequest {
  const request = { action, ...payload };
  const validation = validateMessageRequest(request);

  if (!validation.valid) {
    throw new Error(`Invalid message: ${validation.errors.join(', ')}`);
  }

  return request as MessageRequest;
}

/**
 * Service dependencies for message handlers
 */
export interface MessageServices {
  getSnoozedTabsV2: () => Promise<StorageV2>;
  setSnoozedTabs: (data: unknown) => Promise<void>;
  getSettings: () => Promise<Settings>;
  setSettings: (data: Partial<Settings>) => Promise<void>;
  snooze: (tab: SnoozedItemV2 | chrome.tabs.Tab, popTime: number, groupId?: string) => Promise<void>;
  removeSnoozedTabWrapper: (tab: SnoozedItemV2) => Promise<void>;
  removeWindowGroup: (groupId: string) => Promise<void>;
  restoreWindowGroup: (groupId: string) => Promise<void>;
  importTabs: (data: unknown) => Promise<{ success: boolean; addedCount?: number; error?: string }>;
  getExportData: () => Promise<StorageV2>;
}

type MessageHandler = (request: MessageRequest, services: MessageServices) => Promise<MessageResponse>;

/**
 * Message handler registry
 * Maps action types to their handler functions
 */
export const MESSAGE_HANDLERS: Record<MessageAction, MessageHandler> = {
  [MESSAGE_ACTIONS.GET_SNOOZED_TABS_V2]: async (_request, { getSnoozedTabsV2 }) => {
    return await getSnoozedTabsV2();
  },

  [MESSAGE_ACTIONS.SET_SNOOZED_TABS]: async (request, { setSnoozedTabs }) => {
    const req = request as unknown as { data: unknown };
    await setSnoozedTabs(req.data);
    return { success: true };
  },

  [MESSAGE_ACTIONS.GET_SETTINGS]: async (_request, { getSettings }) => {
    return await getSettings();
  },

  [MESSAGE_ACTIONS.SET_SETTINGS]: async (request, { setSettings }) => {
    const req = request as unknown as { data: Partial<Settings> };
    await setSettings(req.data);
    return { success: true };
  },

  [MESSAGE_ACTIONS.SNOOZE]: async (request, { snooze }) => {
    const req = request as unknown as { tab: SnoozedItemV2 | chrome.tabs.Tab; popTime: number; groupId?: string };
    await snooze(req.tab, req.popTime, req.groupId);
    return { success: true };
  },

  [MESSAGE_ACTIONS.REMOVE_SNOOZED_TAB]: async (request, { removeSnoozedTabWrapper }) => {
    const req = request as unknown as { tab: SnoozedItemV2 };
    await removeSnoozedTabWrapper(req.tab);
    return { success: true };
  },

  [MESSAGE_ACTIONS.CLEAR_ALL_SNOOZED_TABS]: async (_request, { setSnoozedTabs }) => {
    await setSnoozedTabs({ tabCount: 0 });
    return { success: true };
  },

  [MESSAGE_ACTIONS.REMOVE_WINDOW_GROUP]: async (request, { removeWindowGroup }) => {
    const req = request as unknown as { groupId: string };
    await removeWindowGroup(req.groupId);
    return { success: true };
  },

  [MESSAGE_ACTIONS.RESTORE_WINDOW_GROUP]: async (request, { restoreWindowGroup }) => {
    const req = request as unknown as { groupId: string };
    await restoreWindowGroup(req.groupId);
    return { success: true };
  },

  [MESSAGE_ACTIONS.IMPORT_TABS]: async (request, { importTabs }) => {
    const req = request as unknown as { data: unknown };
    return await importTabs(req.data);
  },

  [MESSAGE_ACTIONS.EXPORT_TABS]: async (_request, { getExportData }) => {
    return await getExportData();
  },
};

/**
 * Dispatches a message to the appropriate handler
 */
export async function dispatchMessage(request: MessageRequest, services: MessageServices): Promise<MessageResponse> {
  // Validate request
  const validation = validateMessageRequest(request);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  // Get handler
  const handler = MESSAGE_HANDLERS[request.action as MessageAction];
  if (!handler) {
    throw new Error(`No handler registered for action: ${request.action}`);
  }

  // Execute handler
  return await handler(request, services);
}

/**
 * Helper to send a message and handle response
 */
export function sendMessage<T extends MessageResponse = MessageResponse>(
  action: MessageAction,
  payload: Record<string, unknown> = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const message = createMessage(action, payload);

    chrome.runtime.sendMessage(message, (response: T | { error: string }) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (response && 'error' in response) {
        reject(new Error(response.error));
        return;
      }

      resolve(response as T);
    });
  });
}
