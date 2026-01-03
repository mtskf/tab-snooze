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
        create: vi.fn().mockResolvedValue({}),
        remove: vi.fn().mockResolvedValue(undefined),
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
      },
      action: {
        setBadgeText: vi.fn(),
        setBadgeBackgroundColor: vi.fn(),
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

  describe('snooze (Critical: save before close)', () => {
    it('should save to storage BEFORE removing tab', async () => {
      const tab = { id: 1, url: 'http://test.com', title: 'Test' };
      const popTime = new Date();
      const callOrder = [];

      // Track call order
      global.chrome.storage.local.set = vi.fn(() => {
        callOrder.push('storage.set');
        Object.assign(mockStorage, { snoozedTabs: { tabCount: 1 } });
        return Promise.resolve();
      });
      global.chrome.tabs.remove = vi.fn(() => {
        callOrder.push('tabs.remove');
        return Promise.resolve();
      });
      global.chrome.storage.local.get = vi.fn().mockResolvedValue({});

      await snooze(tab, popTime);

      // Storage should be called BEFORE tabs.remove
      expect(callOrder).toEqual(['storage.set', 'tabs.remove']);
    });

    it('should initialize storage if missing when adding a tab', async () => {
      const tab = { id: 1, url: 'http://test.com', title: 'Test' };
      const popTime = new Date();

      // Ensure clean mocks
      global.chrome.storage.local.get = vi.fn().mockResolvedValue({});
      global.chrome.storage.local.set = vi.fn((obj) => {
        Object.assign(mockStorage, obj);
        return Promise.resolve();
      });

      await snooze(tab, popTime);

      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
      // Check that it initialized and added the tab
      const setCall = chrome.storage.local.set.mock.calls[0][0];
      expect(setCall.snoozedTabs).toBeDefined();
      expect(setCall.snoozedTabs.tabCount).toBe(1);
      expect(setCall.snoozedTabs[popTime.getTime()]).toHaveLength(1);
    });

    // This test must be LAST because it corrupts the storageLock promise chain
    it('should NOT close tab if storage save fails', async () => {
      const tab = { id: 1, url: 'http://test.com', title: 'Test' };
      const popTime = new Date();

      // Make storage fail
      global.chrome.storage.local.set = vi.fn().mockRejectedValue(new Error('Storage full'));
      global.chrome.storage.local.get = vi.fn().mockResolvedValue({});

      // Should throw
      await expect(snooze(tab, popTime)).rejects.toThrow();

      // Tab should NOT have been closed
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });
  });
});
