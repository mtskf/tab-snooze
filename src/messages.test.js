import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MESSAGE_ACTIONS,
  validateMessageRequest,
  createMessage,
  MESSAGE_HANDLERS,
  dispatchMessage,
  sendMessage,
} from './messages.js';

describe('messages', () => {
  describe('MESSAGE_ACTIONS', () => {
    it('defines all expected action constants', () => {
      expect(MESSAGE_ACTIONS).toHaveProperty('GET_SNOOZED_TABS');
      expect(MESSAGE_ACTIONS).toHaveProperty('GET_SNOOZED_TABS_V2');
      expect(MESSAGE_ACTIONS).toHaveProperty('SET_SNOOZED_TABS');
      expect(MESSAGE_ACTIONS).toHaveProperty('GET_SETTINGS');
      expect(MESSAGE_ACTIONS).toHaveProperty('SET_SETTINGS');
      expect(MESSAGE_ACTIONS).toHaveProperty('SNOOZE');
      expect(MESSAGE_ACTIONS).toHaveProperty('REMOVE_SNOOZED_TAB');
      expect(MESSAGE_ACTIONS).toHaveProperty('CLEAR_ALL_SNOOZED_TABS');
      expect(MESSAGE_ACTIONS).toHaveProperty('REMOVE_WINDOW_GROUP');
      expect(MESSAGE_ACTIONS).toHaveProperty('RESTORE_WINDOW_GROUP');
      expect(MESSAGE_ACTIONS).toHaveProperty('IMPORT_TABS');
      expect(MESSAGE_ACTIONS).toHaveProperty('EXPORT_TABS');
    });

    it('uses correct action string values', () => {
      expect(MESSAGE_ACTIONS.GET_SNOOZED_TABS).toBe('getSnoozedTabs');
      expect(MESSAGE_ACTIONS.GET_SNOOZED_TABS_V2).toBe('getSnoozedTabsV2');
      expect(MESSAGE_ACTIONS.SNOOZE).toBe('snooze');
    });
  });

  describe('validateMessageRequest', () => {
    it('validates valid getSnoozedTabs request', () => {
      const request = { action: MESSAGE_ACTIONS.GET_SNOOZED_TABS };
      const result = validateMessageRequest(request);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('validates valid getSnoozedTabsV2 request', () => {
      const request = { action: MESSAGE_ACTIONS.GET_SNOOZED_TABS_V2 };
      const result = validateMessageRequest(request);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects non-object requests', () => {
      const result = validateMessageRequest(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Request must be an object');
    });

    it('rejects requests without action', () => {
      const result = validateMessageRequest({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects unknown actions', () => {
      const result = validateMessageRequest({ action: 'unknownAction' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unknown action'))).toBe(true);
    });

    it('validates setSnoozedTabs requires data', () => {
      const result = validateMessageRequest({ action: MESSAGE_ACTIONS.SET_SNOOZED_TABS });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('data'))).toBe(true);
    });

    it('validates snooze requires tab and popTime', () => {
      const result = validateMessageRequest({ action: MESSAGE_ACTIONS.SNOOZE });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tab'))).toBe(true);
      expect(result.errors.some(e => e.includes('popTime'))).toBe(true);
    });

    it('accepts valid snooze request', () => {
      const request = {
        action: MESSAGE_ACTIONS.SNOOZE,
        tab: { url: 'https://example.com' },
        popTime: 123456789,
      };
      const result = validateMessageRequest(request);
      expect(result.valid).toBe(true);
    });

    it('validates removeWindowGroup requires groupId', () => {
      const result = validateMessageRequest({ action: MESSAGE_ACTIONS.REMOVE_WINDOW_GROUP });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('groupId'))).toBe(true);
    });

    it('validates importTabs requires data object', () => {
      const result = validateMessageRequest({ action: MESSAGE_ACTIONS.IMPORT_TABS });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('data'))).toBe(true);
    });

    it('accepts valid importTabs request', () => {
      const request = {
        action: MESSAGE_ACTIONS.IMPORT_TABS,
        data: { version: 2, items: {}, schedule: {} },
      };
      const result = validateMessageRequest(request);
      expect(result.valid).toBe(true);
    });

    it('validates exportTabs requires no additional properties', () => {
      const request = { action: MESSAGE_ACTIONS.EXPORT_TABS };
      const result = validateMessageRequest(request);
      expect(result.valid).toBe(true);
    });
  });

  describe('createMessage', () => {
    it('creates valid message for simple action', () => {
      const message = createMessage(MESSAGE_ACTIONS.GET_SNOOZED_TABS);
      expect(message).toEqual({ action: MESSAGE_ACTIONS.GET_SNOOZED_TABS });
    });

    it('creates valid message with payload', () => {
      const message = createMessage(MESSAGE_ACTIONS.SNOOZE, {
        tab: { url: 'https://example.com' },
        popTime: 123456789,
      });
      expect(message.action).toBe(MESSAGE_ACTIONS.SNOOZE);
      expect(message.tab).toEqual({ url: 'https://example.com' });
      expect(message.popTime).toBe(123456789);
    });

    it('throws error for invalid message', () => {
      expect(() => {
        createMessage(MESSAGE_ACTIONS.SNOOZE); // Missing required fields
      }).toThrow('Invalid message');
    });
  });

  describe('MESSAGE_HANDLERS', () => {
    it('has handlers for all actions', () => {
      const actions = Object.values(MESSAGE_ACTIONS);
      actions.forEach(action => {
        expect(MESSAGE_HANDLERS).toHaveProperty(action);
        expect(typeof MESSAGE_HANDLERS[action]).toBe('function');
      });
    });

    it('getSnoozedTabs handler calls getValidatedSnoozedTabs', async () => {
      const mockService = {
        getValidatedSnoozedTabs: vi.fn().mockResolvedValue({ tabCount: 5 }),
      };

      const request = { action: MESSAGE_ACTIONS.GET_SNOOZED_TABS };
      const result = await MESSAGE_HANDLERS[MESSAGE_ACTIONS.GET_SNOOZED_TABS](request, mockService);

      expect(mockService.getValidatedSnoozedTabs).toHaveBeenCalled();
      expect(result).toEqual({ tabCount: 5 });
    });

    it('getSnoozedTabsV2 handler calls getSnoozedTabsV2', async () => {
      const mockV2Data = {
        version: 2,
        items: { 'tab-1': { url: 'https://example.com' } },
        schedule: { '1234567890': ['tab-1'] },
      };
      const mockService = {
        getSnoozedTabsV2: vi.fn().mockResolvedValue(mockV2Data),
      };

      const request = { action: MESSAGE_ACTIONS.GET_SNOOZED_TABS_V2 };
      const result = await MESSAGE_HANDLERS[MESSAGE_ACTIONS.GET_SNOOZED_TABS_V2](request, mockService);

      expect(mockService.getSnoozedTabsV2).toHaveBeenCalled();
      expect(result).toEqual(mockV2Data);
    });

    it('snooze handler calls snooze with correct params', async () => {
      const mockService = {
        snooze: vi.fn().mockResolvedValue(undefined),
      };

      const request = {
        action: MESSAGE_ACTIONS.SNOOZE,
        tab: { url: 'https://example.com' },
        popTime: 123456789,
        groupId: 'group-1',
      };

      const result = await MESSAGE_HANDLERS[MESSAGE_ACTIONS.SNOOZE](request, mockService);

      expect(mockService.snooze).toHaveBeenCalledWith(
        { url: 'https://example.com' },
        123456789,
        'group-1'
      );
      expect(result).toEqual({ success: true });
    });

    it('importTabs handler calls importTabs with data', async () => {
      const mockResult = { success: true, addedCount: 5 };
      const mockService = {
        importTabs: vi.fn().mockResolvedValue(mockResult),
      };

      const importData = { version: 2, items: {}, schedule: {} };
      const request = {
        action: MESSAGE_ACTIONS.IMPORT_TABS,
        data: importData,
      };

      const result = await MESSAGE_HANDLERS[MESSAGE_ACTIONS.IMPORT_TABS](request, mockService);

      expect(mockService.importTabs).toHaveBeenCalledWith(importData);
      expect(result).toEqual(mockResult);
    });

    it('exportTabs handler calls getExportData', async () => {
      const mockV2Data = {
        version: 2,
        items: { 'tab-1': { url: 'https://example.com' } },
        schedule: { '1234567890': ['tab-1'] },
      };
      const mockService = {
        getExportData: vi.fn().mockResolvedValue(mockV2Data),
      };

      const request = { action: MESSAGE_ACTIONS.EXPORT_TABS };
      const result = await MESSAGE_HANDLERS[MESSAGE_ACTIONS.EXPORT_TABS](request, mockService);

      expect(mockService.getExportData).toHaveBeenCalled();
      expect(result).toEqual(mockV2Data);
    });
  });

  describe('dispatchMessage', () => {
    it('dispatches message to correct handler', async () => {
      const mockService = {
        getValidatedSnoozedTabs: vi.fn().mockResolvedValue({ tabCount: 3 }),
      };

      const request = { action: MESSAGE_ACTIONS.GET_SNOOZED_TABS };
      const result = await dispatchMessage(request, mockService);

      expect(result).toEqual({ tabCount: 3 });
      expect(mockService.getValidatedSnoozedTabs).toHaveBeenCalled();
    });

    it('dispatches setSettings to the handler with payload', async () => {
      const mockService = {
        setSettings: vi.fn().mockResolvedValue(undefined),
      };

      const payload = { 'start-day': '9:00 AM', timezone: 'UTC' };
      const request = { action: MESSAGE_ACTIONS.SET_SETTINGS, data: payload };

      const result = await dispatchMessage(request, mockService);

      expect(mockService.setSettings).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ success: true });
    });

    it('dispatches setSnoozedTabs to the handler with payload', async () => {
      const mockService = {
        setSnoozedTabs: vi.fn().mockResolvedValue(undefined),
      };

      const payload = { tabCount: 0 };
      const request = { action: MESSAGE_ACTIONS.SET_SNOOZED_TABS, data: payload };

      const result = await dispatchMessage(request, mockService);

      expect(mockService.setSnoozedTabs).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ success: true });
    });

    it('throws error for invalid request', async () => {
      await expect(
        dispatchMessage({ action: 'invalid' }, {})
      ).rejects.toThrow('Unknown action');
    });

    it('throws error for missing handler', async () => {
      // Temporarily remove a handler
      const originalHandler = MESSAGE_HANDLERS[MESSAGE_ACTIONS.GET_SNOOZED_TABS];
      delete MESSAGE_HANDLERS[MESSAGE_ACTIONS.GET_SNOOZED_TABS];

      await expect(
        dispatchMessage({ action: MESSAGE_ACTIONS.GET_SNOOZED_TABS }, {})
      ).rejects.toThrow('No handler registered');

      // Restore handler
      MESSAGE_HANDLERS[MESSAGE_ACTIONS.GET_SNOOZED_TABS] = originalHandler;
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      global.chrome = {
        runtime: {
          sendMessage: vi.fn(),
          lastError: null,
        },
      };
    });

    it('sends message and resolves with response', async () => {
      const mockResponse = { tabCount: 5 };
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback(mockResponse);
      });

      const result = await sendMessage(MESSAGE_ACTIONS.GET_SNOOZED_TABS);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: MESSAGE_ACTIONS.GET_SNOOZED_TABS },
        expect.any(Function)
      );
      expect(result).toEqual(mockResponse);
    });

    it('rejects on chrome.runtime.lastError', async () => {
      chrome.runtime.lastError = { message: 'Connection error' };
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback(null);
      });

      await expect(
        sendMessage(MESSAGE_ACTIONS.GET_SNOOZED_TABS)
      ).rejects.toThrow('Connection error');

      chrome.runtime.lastError = null;
    });

    it('rejects on error response', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ error: 'Unknown action' });
      });

      await expect(
        sendMessage(MESSAGE_ACTIONS.GET_SNOOZED_TABS)
      ).rejects.toThrow('Unknown action');
    });

    it('sends message with payload', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        callback({ success: true });
      });

      await sendMessage(MESSAGE_ACTIONS.SNOOZE, {
        tab: { url: 'https://example.com' },
        popTime: 123456789,
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          action: MESSAGE_ACTIONS.SNOOZE,
          tab: { url: 'https://example.com' },
          popTime: 123456789,
        },
        expect.any(Function)
      );
    });
  });
});
