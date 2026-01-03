import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { snooze, popCheck, removeSnoozedTabWrapper, initStorage } from './snoozeLogic';

describe('snoozeLogic', () => {
  // Helper to mock storage get/set
  let mockStorage = {};

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
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
            if (typeof key === 'string') {
              return Promise.resolve({ [key]: mockStorage[key] });
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
        setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
        setBadgeText: vi.fn().mockResolvedValue(undefined),
      }
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('snooze', () => {
    it('should snooze a tab correctly', async () => {
      // Setup initial mock storage
      mockStorage.snoozedTabs = {};

      const tab = {
        id: 123,
        url: 'https://example.com',
        title: 'Example',
        favIconUrl: 'https://example.com/favicon.ico',
        index: 0
      };

      const popTime = new Date('2024-01-01T10:00:00Z');

      await snooze(tab, popTime);

      // Verify tab removal
      expect(chrome.tabs.remove).toHaveBeenCalledWith(123);

      // Verify storage update
      expect(chrome.storage.local.set).toHaveBeenCalled();
      const savedData = mockStorage.snoozedTabs;
      const timeKey = popTime.getTime();
      expect(savedData[timeKey]).toHaveLength(1);
      expect(savedData[timeKey][0].url).toBe('https://example.com');
      expect(savedData.tabCount).toBe(1);
    });

    it('should not remove tab if storage fails', async () => {
      mockStorage.snoozedTabs = {};

      const tab = {
        id: 123,
        url: 'https://example.com',
        title: 'Example',
        favIconUrl: 'https://example.com/favicon.ico',
        index: 0
      };

      const popTime = new Date('2024-01-01T10:00:00Z');

      // Mock storage.local.set to fail
      global.chrome.storage.local.set = vi.fn().mockRejectedValue(new Error('Storage write failed'));

      // Logic changed: now snooze throws if storage fails (to prevent closing tab without saving)
      await expect(snooze(tab, popTime)).rejects.toThrow('Storage write failed');

      // Tab removal happens AFTER save now, so if save fails, remove should NOT be called
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });
  });

  describe('popCheck', () => {
    it('should restore tabs when time is up', async () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime();
      vi.setSystemTime(now);

      // Mock stored snoozed tabs (past time)
      const pastTime = now - 1000;
      mockStorage.snoozedTabs = {
        [pastTime]: [
          { url: 'https://restored.com', title: 'Restored' }
        ],
        tabCount: 1
      };

      // Mock window for restoration
      chrome.windows.getLastFocused.mockResolvedValue({ id: 999 });

      const result = await popCheck();

      // Verify restoration
      expect(result.count).toBe(1);
      expect(chrome.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://restored.com',
        windowId: 999
      }));

      // Verify cleanup
      expect(mockStorage.snoozedTabs[pastTime]).toBeUndefined();
      expect(mockStorage.snoozedTabs.tabCount).toBe(0);
    });

    it('should not restore tabs if time is not up', async () => {
      const now = new Date('2024-01-01T10:00:00Z').getTime();
      vi.setSystemTime(now);

      // Mock future tab
      const futureTime = now + 10000;
      mockStorage.snoozedTabs = {
        [futureTime]: [
          { url: 'https://future.com', title: 'Future' }
        ],
        tabCount: 1
      };

      const result = await popCheck();

      expect(result.count).toBe(0);
      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });
  });

  describe('removeSnoozedTabWrapper', () => {
    it('should remove a snoozed tab', async () => {
      const creationTime = 123456789;
      const popTime = 987654321;

      mockStorage.snoozedTabs = {
        [popTime]: [
          { url: 'https://test.com', creationTime: creationTime }
        ],
        tabCount: 1
      };

      const tabToRemove = {
        popTime: new Date(popTime),
        creationTime: creationTime,
        url: 'https://test.com'
      };

      await removeSnoozedTabWrapper(tabToRemove);

      expect(mockStorage.snoozedTabs[popTime]).toBeUndefined();
      expect(mockStorage.snoozedTabs.tabCount).toBe(0);
    });
  });

  describe('checkStorageSize', () => {
    // Import dynamically since we need to add the function first
    const STORAGE_LIMIT = 10 * 1024 * 1024; // 10MB
    const WARNING_THRESHOLD = 0.8 * STORAGE_LIMIT; // 8MB
    const CLEAR_THRESHOLD = 0.7 * STORAGE_LIMIT;   // 7MB
    const THROTTLE_MS = 24 * 60 * 60 * 1000;       // 24 hours

    beforeEach(() => {
      // Add getBytesInUse mock (Chrome)
      chrome.storage.local.getBytesInUse = vi.fn();
      // Add notifications mock
      chrome.notifications = {
        create: vi.fn().mockResolvedValue('storage-warning'),
      };
    });

    it('should set sizeWarningActive to true when usage > 80%', async () => {
      const { checkStorageSize } = await import('./snoozeLogic');

      // Simulate 85% usage
      chrome.storage.local.getBytesInUse.mockResolvedValue(0.85 * STORAGE_LIMIT);
      mockStorage.sizeWarningActive = false;

      await checkStorageSize();

      expect(mockStorage.sizeWarningActive).toBe(true);
    });

    it('should set sizeWarningActive to false when usage < 70%', async () => {
      const { checkStorageSize } = await import('./snoozeLogic');

      // Simulate 60% usage
      chrome.storage.local.getBytesInUse.mockResolvedValue(0.6 * STORAGE_LIMIT);
      mockStorage.sizeWarningActive = true;

      await checkStorageSize();

      expect(mockStorage.sizeWarningActive).toBe(false);
    });

    it('should not change state in hysteresis zone (70-80%)', async () => {
      const { checkStorageSize } = await import('./snoozeLogic');

      // Simulate 75% usage
      chrome.storage.local.getBytesInUse.mockResolvedValue(0.75 * STORAGE_LIMIT);

      // Test: was false, should stay false
      mockStorage.sizeWarningActive = false;
      await checkStorageSize();
      expect(mockStorage.sizeWarningActive).toBe(false);

      // Test: was true, should stay true
      mockStorage.sizeWarningActive = true;
      await checkStorageSize();
      expect(mockStorage.sizeWarningActive).toBe(true);
    });

    it('should throttle notifications to once per 24h', async () => {
      const { checkStorageSize } = await import('./snoozeLogic');
      const now = Date.now();
      vi.setSystemTime(now);

      // Simulate 85% usage, first warning
      chrome.storage.local.getBytesInUse.mockResolvedValue(0.85 * STORAGE_LIMIT);
      mockStorage.sizeWarningActive = false;
      mockStorage.lastSizeWarningAt = undefined;

      await checkStorageSize();

      expect(chrome.notifications.create).toHaveBeenCalledTimes(1);
      expect(mockStorage.lastSizeWarningAt).toBe(now);

      // Reset mock and set state back to false to test throttling
      chrome.notifications.create.mockClear();
      mockStorage.sizeWarningActive = false; // Reset to trigger notification path again

      // Try again immediately - should be throttled by lastSizeWarningAt
      await checkStorageSize();
      expect(chrome.notifications.create).not.toHaveBeenCalled();

      // Advance time by 25 hours and reset state
      vi.setSystemTime(now + 25 * 60 * 60 * 1000);
      mockStorage.sizeWarningActive = false; // Reset to trigger notification path again
      await checkStorageSize();
      expect(chrome.notifications.create).toHaveBeenCalledTimes(1);
    });

    it('should handle Firefox gracefully (getBytesInUse not available)', async () => {
      const { checkStorageSize } = await import('./snoozeLogic');

      // Simulate Firefox: getBytesInUse throws or doesn't exist
      chrome.storage.local.getBytesInUse.mockRejectedValue(new Error('Not supported'));
      mockStorage.sizeWarningActive = false;

      // Should not throw
      await expect(checkStorageSize()).resolves.not.toThrow();

      // Should not change state
      expect(mockStorage.sizeWarningActive).toBe(false);
      expect(chrome.notifications.create).not.toHaveBeenCalled();
    });

    it('should create notification with correct message when threshold exceeded', async () => {
      const { checkStorageSize } = await import('./snoozeLogic');

      chrome.storage.local.getBytesInUse.mockResolvedValue(0.85 * STORAGE_LIMIT);
      mockStorage.sizeWarningActive = false;
      mockStorage.lastSizeWarningAt = undefined;

      await checkStorageSize();

      expect(chrome.notifications.create).toHaveBeenCalledWith(
        'storage-warning',
        expect.objectContaining({
          type: 'basic',
          title: expect.stringContaining('full'),
          message: expect.stringContaining('delete'),
        })
      );
    });
  });
});
