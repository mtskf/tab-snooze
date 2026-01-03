import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { removeSnoozedTabWrapper, removeWindowGroup, restoreWindowGroup, snooze } from './snoozeLogic';

describe('snoozeLogic Safety Checks', () => {
  let mockStorage = {};

  beforeEach(() => {
    vi.resetAllMocks();
    mockStorage = {};

    global.chrome = {
      windows: {
        getLastFocused: vi.fn(),
        create: vi.fn(),
      },
      tabs: {
        create: vi.fn(),
        remove: vi.fn(),
      },
      storage: {
        local: {
          get: vi.fn((key) => {
             // Return null/undefined for snoozedTabs to simulate cleared storage
            if (key === 'snoozedTabs') {
               return Promise.resolve({ snoozedTabs: undefined });
            }
            return Promise.resolve(mockStorage);
          }),
          set: vi.fn((obj) => {
            Object.assign(mockStorage, obj);
            return Promise.resolve();
          })
        }
      }
    };
  });

  describe('removeSnoozedTabWrapper', () => {
    it('should not throw if storage is empty/null', async () => {
      const tabToRemove = {
        popTime: new Date().getTime(),
        creationTime: 12345
      };
      // Should not throw
      await expect(removeSnoozedTabWrapper(tabToRemove)).resolves.not.toThrow();
      // Should not attempt to set storage
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('removeWindowGroup', () => {
    it('should not throw if storage is empty/null', async () => {
      await expect(removeWindowGroup('some-group-id')).resolves.not.toThrow();
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('restoreWindowGroup', () => {
    it('should not throw if storage is empty/null', async () => {
      await expect(restoreWindowGroup('some-group-id')).resolves.not.toThrow();
      expect(chrome.windows.create).not.toHaveBeenCalled();
    });
  });

   describe('snooze (addSnoozedTab)', () => {
    it('should initialize storage if missing when adding a tab', async () => {
      const tab = { id: 1, url: 'http://test.com', title: 'Test' };
      const popTime = new Date();

      // Mock get to return undefined first
       global.chrome.storage.local.get = vi.fn().mockResolvedValue({});

      await snooze(tab, popTime, false);

      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
      // Check that it initialized and added the tab
      const setCall = chrome.storage.local.set.mock.calls[0][0];
      expect(setCall.snoozedTabs).toBeDefined();
      expect(setCall.snoozedTabs.tabCount).toBe(1);
      expect(setCall.snoozedTabs[popTime.getTime()]).toHaveLength(1);
    });
  });
});
