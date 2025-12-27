import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSnoozedTabs,
  setSnoozedTabs,
  getSettings,
  setSettings,
} from './snoozeLogic';

describe('Storage Helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Setup chrome.storage.local mock
    global.chrome = {
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn(),
        },
      },
    };
  });

  describe('getSnoozedTabs', () => {
    it('should return snoozedTabs from storage', async () => {
      const mockTabs = { tabCount: 5, '123456': [{ url: 'test.com' }] };
      chrome.storage.local.get.mockResolvedValue({ snoozedTabs: mockTabs });

      const result = await getSnoozedTabs();

      expect(chrome.storage.local.get).toHaveBeenCalledWith('snoozedTabs');
      expect(result).toEqual(mockTabs);
    });

    it('should return undefined when no snoozedTabs exist', async () => {
      chrome.storage.local.get.mockResolvedValue({});

      const result = await getSnoozedTabs();

      expect(result).toBeUndefined();
    });
  });

  describe('setSnoozedTabs', () => {
    it('should save snoozedTabs to storage', async () => {
      const mockTabs = { tabCount: 3 };
      chrome.storage.local.set.mockResolvedValue();

      await setSnoozedTabs(mockTabs);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ snoozedTabs: mockTabs });
    });
  });

  describe('getSettings', () => {
    it('should return settings from storage', async () => {
      const mockSettings = { 'start-day': '8:00 AM' };
      chrome.storage.local.get.mockResolvedValue({ settings: mockSettings });

      const result = await getSettings();

      expect(chrome.storage.local.get).toHaveBeenCalledWith('settings');
      expect(result).toEqual(mockSettings);
    });
  });

  describe('setSettings', () => {
    it('should save settings to storage', async () => {
      const mockSettings = { 'end-day': '5:00 PM' };
      chrome.storage.local.set.mockResolvedValue();

      await setSettings(mockSettings);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ settings: mockSettings });
    });
  });
});
