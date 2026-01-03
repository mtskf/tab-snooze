import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { removeSnoozedTabWrapper, removeWindowGroup, restoreWindowGroup, snooze, popCheck, initStorage, recoverFromBackup } from './snoozeLogic';

// Helpers
const MOCK_TIME = 1625097600000;
const TAB_URL = 'https://example.com';

const createV2Data = (items = {}, schedule = {}) => ({
  snoooze_v2: {
    items,
    schedule
  }
});

const createItem = (id, popTime, overrides = {}) => ({
  id,
  url: TAB_URL,
  creationTime: MOCK_TIME - 3600000,
  popTime,
  ...overrides
});

describe('snoozeLogic Safety Checks (V2)', () => {
  let mockStorage = {};

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TIME);
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
             if (key === null) return Promise.resolve(mockStorage);
             if (typeof key === 'string') return Promise.resolve({ [key]: mockStorage[key] });
             return Promise.resolve(mockStorage);
          }),
          set: vi.fn((obj) => {
            Object.assign(mockStorage, obj);
            return Promise.resolve();
          }),
          remove: vi.fn()
        },
        session: { set: vi.fn() }
      },
      action: {
        setBadgeText: vi.fn(),
        setBadgeBackgroundColor: vi.fn(),
      },
      notifications: { create: vi.fn() }
    };
  });

  afterEach(() => {
      vi.useRealTimers();
  });

  it('initStorage triggers recovery and sets notification when V2 data is invalid', async () => {
    mockStorage = {
      snoooze_v2: { items: 'oops', schedule: {} }
    };
    chrome.storage.local.get.mockResolvedValue(mockStorage);

    await initStorage();

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        snoooze_v2: expect.objectContaining({
          items: expect.any(Object),
          schedule: expect.any(Object),
        })
      })
    );
    expect(chrome.storage.session.set).toHaveBeenCalledWith(
      expect.objectContaining({ pendingRecoveryNotification: expect.any(Number) })
    );
  });

  describe('removeSnoozedTabWrapper', () => {
    it('should not throw if storage is empty/null', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      const tabToRemove = { id: 'missing' };
      await expect(removeSnoozedTabWrapper(tabToRemove)).resolves.not.toThrow();
      // Should not set new data if nothing found (optimization) or set same data
      // Current implementation saves anyway if it loaded successfully
    });
  });

  describe('removeWindowGroup', () => {
    it('should not throw if storage is empty/null', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      await expect(removeWindowGroup('some-group-id')).resolves.not.toThrow();
    });
  });

  describe('restoreWindowGroup', () => {
    it('should not throw if storage is empty/null', async () => {
      chrome.storage.local.get.mockResolvedValue({});
      await expect(restoreWindowGroup('some-group-id')).resolves.not.toThrow();
      expect(chrome.windows.create).not.toHaveBeenCalled();
    });

    it('should preserve storage if restoration is partial (tab count mismatch)', async () => {
        const now = Date.now();
        const pastTime = now - 1000;
        const groupId = 'partial-fail-group';

        const item1 = createItem('t1', pastTime, { groupId });
        const item2 = createItem('t2', pastTime, { groupId });

        mockStorage = createV2Data(
            { 't1': item1, 't2': item2 },
            { [pastTime]: ['t1', 't2'] }
        );
        chrome.storage.local.get.mockResolvedValue(mockStorage);

        // Mock partial success (only 1 tab restored)
        global.chrome.windows.create = vi.fn().mockResolvedValue({
            id: 999,
            tabs: [{ id: 100, url: TAB_URL }] // Only 1 tab
        });

        await restoreWindowGroup(groupId);

        expect(chrome.windows.create).toHaveBeenCalled();

        // Ensure NO storage update (preservation)
        // If removeWindowGroup was called, it would call set.
        // We expect it NOT to be called.
        // HOWEVER, restoreWindowGroup does not call set loop unless it removes.
        // So checking if set was called is valid if we assume internal implementation prevents write on failure.
        // Actually `restoreWindowGroup` logic calls `removeWindowGroup` only on success.
        // `removeWindowGroup` calls `set`.
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('snooze (Critical: save before close)', () => {
    it('should save to storage BEFORE removing tab', async () => {
      const tab = { id: 1, url: 'http://test.com', title: 'Test' };
      const popTime = new Date();
      const callOrder = [];

      global.chrome.storage.local.set = vi.fn(() => {
        callOrder.push('storage.set');
        return Promise.resolve();
      });
      global.chrome.tabs.remove = vi.fn(() => {
        callOrder.push('tabs.remove');
        return Promise.resolve();
      });
      global.chrome.storage.local.get.mockResolvedValue(createV2Data());

      await snooze(tab, popTime);

      expect(callOrder).toEqual(['storage.set', 'tabs.remove']);
    });

    it('should ignore and NOT snooze restricted URLs', async () => {
      const restrictedTab = { id: 99, url: 'chrome://extensions', title: 'Extensions' };
      const popTime = new Date();

      global.chrome.storage.local.set.mockClear();
      global.chrome.tabs.remove.mockClear();

      await snooze(restrictedTab, popTime);

      expect(chrome.storage.local.set).not.toHaveBeenCalled();
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });
  });

  describe('popCheck (Restoration Safety)', () => {
    it('should NOT remove tabs from storage if restoration fails', async () => {
      const now = Date.now();
      const pastTime = now - 1000;
      const id = 't1';
      const item = createItem(id, pastTime);

      mockStorage = createV2Data({ [id]: item }, { [pastTime]: [id] });
      chrome.storage.local.get.mockResolvedValue(mockStorage);

      // Failures
      global.chrome.tabs.create.mockRejectedValue(new Error('Failed tab'));
      global.chrome.windows.create.mockRejectedValue(new Error('Failed win'));
      global.chrome.windows.getLastFocused.mockResolvedValue({ id: 999 });

      await popCheck();

      // Check storage updates
      // Cleanup happens at end. If restoreTabs finds nothing restored, it removes nothing.
      // So set IS called (cleaning up nothing), but data should remain.
      if (chrome.storage.local.set.mock.calls.length > 0) {
          const savedData = chrome.storage.local.set.mock.lastCall[0].snoooze_v2;
          expect(savedData.items[id]).toBeDefined();
      } else {
          expect(true).toBe(true);
      }
    });
  });

  it('should handle storage failure gracefully even if tab is removed', async () => {
    const tab = { id: 1, url: 'http://test.com', title: 'Test' };
    const popTime = new Date();

    global.chrome.storage.local.set.mockRejectedValue(new Error('Storage full'));
    global.chrome.storage.local.get.mockResolvedValue(createV2Data());

    await expect(snooze(tab, popTime)).rejects.toThrow();
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
  });

  it('should correctly cleanup ONLY successfully restored tabs', async () => {
      const now = Date.now();
      const pastTime = now - 1000;

      const i1 = createItem('t1', pastTime, { url: 'http://ok.com' });
      const i2 = createItem('t2', pastTime, { url: 'http://fail.com' });

      mockStorage = createV2Data(
          { 't1': i1, 't2': i2 },
          { [pastTime]: ['t1', 't2'] }
      );
      chrome.storage.local.get.mockResolvedValue(mockStorage);
      chrome.windows.create.mockResolvedValue({ id: 100 });
      chrome.windows.getLastFocused.mockResolvedValue({ id: 100 });

      // Succeed for t1, Fail for t2
      global.chrome.tabs.create.mockImplementation((opts) => {
          if (opts.url === 'http://ok.com') return Promise.resolve({});
          return Promise.reject(new Error('Failed'));
      });

      await popCheck();

      expect(chrome.storage.local.set).toHaveBeenCalled();
      const savedV2 = chrome.storage.local.set.mock.lastCall[0].snoooze_v2;

      // t1 removed, t2 kept
      expect(savedV2.items['t1']).toBeUndefined();
      expect(savedV2.items['t2']).toBeDefined();
  });

  it('should NOT remove tabs from storage if window creation partially fails', async () => {
      const now = Date.now();
      const pastTime = now - 1000;
      const groupId = 'g1';

      const i1 = createItem('t1', pastTime, { groupId });
      const i2 = createItem('t2', pastTime, { groupId }); // Ignored by partial restore

      mockStorage = createV2Data(
          { 't1': i1, 't2': i2 },
          { [pastTime]: ['t1', 't2'] }
      );
      chrome.storage.local.get.mockResolvedValue(mockStorage);

      // Partial success
      global.chrome.windows.create.mockResolvedValue({
          id: 100,
          tabs: [{ id: 101, url: TAB_URL }] // Only 1 tab
      });

      await popCheck();

      // Ensure both preserved
      if (chrome.storage.local.set.mock.calls.length > 0) {
          const savedV2 = chrome.storage.local.set.mock.lastCall[0].snoooze_v2;
          expect(savedV2.items['t1']).toBeDefined();
          expect(savedV2.items['t2']).toBeDefined();
      }
  });

  describe('recoverFromBackup', () => {
      it('should prefer an older VALID backup over a newer INVALID backup', async () => {
          const validOld = createV2Data({ 't1': createItem('t1', MOCK_TIME) }, { [MOCK_TIME]: ['t1'] }).snoooze_v2;
          const invalidNew = { items: 'broken', schedule: {} };

          mockStorage = {
              'snoozedTabs_backup_100': validOld,  // Oldest
              'snoozedTabs_backup_200': invalidNew // Newest
          };
          chrome.storage.local.get.mockResolvedValue(mockStorage);

          const result = await recoverFromBackup();

          expect(result.recovered).toBe(true);
          expect(result.tabCount).toBe(1);
          // Should save the valid old backup
          expect(chrome.storage.local.set).toHaveBeenCalledWith(
              expect.objectContaining({ snoooze_v2: validOld })
          );
      });

      it('should prefer sanitized backup with MORE items over newer sanitized backup with FEWER items', async () => {
          // Backup A (Newest): Invalid structure, sanitizes to 0 items
          const backupA = { items: { 't1': { id: 't1' } }, schedule: {} }; // Missing required fields, sanitize clears it

          // Backup B (Middle): Invalid structure (orphaned ID), sanitizes to 1 item
          // Corrupt V2: schedule references t2, but t2 is valid. t3 is missing.
          const item2 = createItem('t2', MOCK_TIME);
          const backupB = {
              items: { 't2': item2 },
              schedule: { [MOCK_TIME]: ['t2', 'missing'] } // 'missing' dropped, t2 kept
          };

          // Backup C (Oldest): Invalid structure, sanitizes to 0 items
          const backupC = { items: 'invalid', schedule: {} };

          mockStorage = {
              'snoozedTabs_backup_300': backupA,
              'snoozedTabs_backup_200': backupB,
              'snoozedTabs_backup_100': backupC
          };
          chrome.storage.local.get.mockResolvedValue(mockStorage);

          const result = await recoverFromBackup();

          expect(result.recovered).toBe(true);
          expect(result.sanitized).toBe(true);
          expect(result.tabCount).toBe(1); // Should pick Backup B

          // Should save the sanitized version of B
          const expectedSaved = {
              items: { 't2': item2 },
              schedule: { [MOCK_TIME]: ['t2'] }
          };
          expect(chrome.storage.local.set).toHaveBeenCalledWith(
              expect.objectContaining({ snoooze_v2: expectedSaved })
          );
      });
  });

});
