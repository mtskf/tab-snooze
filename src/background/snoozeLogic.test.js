import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { snooze, popCheck, removeSnoozedTabWrapper, initStorage } from './snoozeLogic';

// Mock storage utils
vi.mock('../utils/storage', () => ({
  getSnoozedTabs: vi.fn(),
  setSnoozedTabs: vi.fn(),
  getSettings: vi.fn(),
  setSettings: vi.fn(),
}));

import { getSnoozedTabs, setSnoozedTabs, getSettings, setSettings } from '../utils/storage';

describe('snoozeLogic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    // Ensure chrome is available
    if (!global.chrome) {
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
                local: { get: vi.fn(), set: vi.fn() }
            },
            action: {
                setBadgeBackgroundColor: vi.fn()
            }
        };
    } else {
        // Extend existing mock if needed
        if (!global.chrome.windows) global.chrome.windows = { getLastFocused: vi.fn(), create: vi.fn() };
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('snooze', () => {
    it('should snooze a tab correctly', async () => {
      // Setup mock data
      getSnoozedTabs.mockResolvedValue({});

      const tab = {
        id: 123,
        url: 'https://example.com',
        title: 'Example',
        favIconUrl: 'https://example.com/favicon.ico',
        index: 0
      };

      const popTime = new Date('2024-01-01T10:00:00Z');

      await snooze(tab, popTime, false);

      // Verify tab removal
      expect(chrome.tabs.remove).toHaveBeenCalledWith(123);

      // Verify storage update
      expect(setSnoozedTabs).toHaveBeenCalled();
      const savedData = setSnoozedTabs.mock.calls[0][0];
      const timeKey = popTime.getTime();
      expect(savedData[timeKey]).toHaveLength(1);
      expect(savedData[timeKey][0].url).toBe('https://example.com');
      expect(savedData.tabCount).toBe(1);
    });
  });

  describe('popCheck', () => {
    it('should restore tabs when time is up', async () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime();
      vi.setSystemTime(now); // System time matches "now"

      // Mock stored snoozed tabs (past time)
      const pastTime = now - 1000; // 1 second ago
      const snoozedData = {
        [pastTime]: [
          { url: 'https://restored.com', title: 'Restored' }
        ],
        tabCount: 1
      };
      getSnoozedTabs.mockResolvedValue(snoozedData);

      // Mock window for restoration
      chrome.windows.getLastFocused.mockResolvedValue({ id: 999 });

      const result = await popCheck();

      // Verify restoration
      expect(result.count).toBe(1);
      expect(chrome.tabs.create).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://restored.com',
        windowId: 999
      }));

      // Verify cleanup (should remove the processed time key)
      const finalSave = setSnoozedTabs.mock.lastCall[0];
      expect(finalSave[pastTime]).toBeUndefined();
      expect(finalSave.tabCount).toBe(0);
    });

    it('should not restore tabs if time is not up', async () => {
        const now = new Date('2024-01-01T10:00:00Z').getTime();
        vi.setSystemTime(now);

        // Mock future tab
        const futureTime = now + 10000;
        const snoozedData = {
          [futureTime]: [
            { url: 'https://future.com', title: 'Future' }
          ],
          tabCount: 1
        };
        getSnoozedTabs.mockResolvedValue(snoozedData);

        const result = await popCheck();

        expect(result.count).toBe(0);
        expect(chrome.tabs.create).not.toHaveBeenCalled();
    });
  });

  describe('removeSnoozedTabWrapper', () => {
      it('should remove a snoozed tab', async () => {
          const creationTime = 123456789;
          const popTime = 987654321;

          const snoozedData = {
              [popTime]: [
                  { url: 'https://test.com', creationTime: creationTime }
              ],
              tabCount: 1
          };
          getSnoozedTabs.mockResolvedValue(snoozedData);

          const tabToRemove = {
              popTime: new Date(popTime), // Wrapper expects calling code ensuring this format or logic handles it
              creationTime: creationTime
          };

          await removeSnoozedTabWrapper(tabToRemove);

          const savedData = setSnoozedTabs.mock.lastCall[0];
          expect(savedData[popTime]).toBeUndefined(); // Should be removed as it was empty
          expect(savedData.tabCount).toBe(0);
      });
  });
});
