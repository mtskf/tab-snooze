import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { removeSnoozedTabWrapper, removeWindowGroup, restoreWindowGroup, snooze, popCheck, initStorage, recoverFromBackup } from './snoozeLogic';
import type { SnoozedItemV2 } from '../types';

// Type for V2 storage data in tests (version is optional for flexibility)
interface TestStorageV2 {
  version?: number;
  items: Record<string, SnoozedItemV2>;
  schedule: Record<string, string[]>;
}

// Helpers
const MOCK_TIME = 1625097600000;
const TAB_URL = 'https://example.com';

const createV2Data = (items: Record<string, SnoozedItemV2> = {}, schedule: Record<string, string[]> = {}): { snoooze_v2: TestStorageV2 } => ({
  snoooze_v2: {
    items,
    schedule
  }
});

const createItem = (id: string, popTime: number, overrides: Partial<SnoozedItemV2> = {}): SnoozedItemV2 => ({
  id,
  url: TAB_URL,
  creationTime: MOCK_TIME - 3600000,
  popTime,
  ...overrides
});

describe('snoozeLogic Safety Checks (V2)', () => {
  let mockStorage: Record<string, unknown> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TIME);
    mockStorage = {};

    globalThis.chrome = {
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
          get: vi.fn((key: string | string[] | null) => {
             if (key === null) return Promise.resolve(mockStorage);
             if (typeof key === 'string') return Promise.resolve({ [key]: mockStorage[key] });
             return Promise.resolve(mockStorage);
          }),
          set: vi.fn((obj: Record<string, unknown>) => {
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
    } as unknown as typeof chrome;
  });

  afterEach(() => {
      vi.useRealTimers();
  });

  it('initStorage triggers recovery and sets notification when V2 data is invalid', async () => {
    mockStorage = {
      snoooze_v2: { items: 'oops', schedule: {} }
    };
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockStorage);

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
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
      // Test with minimal data to check defensive handling
      const tabToRemove = { id: 'missing' } as unknown as SnoozedItemV2;
      await expect(removeSnoozedTabWrapper(tabToRemove)).resolves.not.toThrow();
      // Should not set new data if nothing found (optimization) or set same data
      // Current implementation saves anyway if it loaded successfully
    });
  });

  describe('removeWindowGroup', () => {
    it('should not throw if storage is empty/null', async () => {
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
      await expect(removeWindowGroup('some-group-id')).resolves.not.toThrow();
    });
  });

  describe('restoreWindowGroup', () => {
    it('should not throw if storage is empty/null', async () => {
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
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
        (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockStorage);

        // Mock partial success (only 1 tab restored)
        (chrome.windows.create as ReturnType<typeof vi.fn>).mockResolvedValue({
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
      const popTime = Date.now() + 3600000;
      const callOrder: string[] = [];

      (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('storage.set');
        return Promise.resolve();
      });
      (chrome.tabs.remove as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callOrder.push('tabs.remove');
        return Promise.resolve();
      });
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue(createV2Data());

      await snooze(tab, popTime);

      expect(callOrder).toEqual(['storage.set', 'tabs.remove']);
    });

    it('should ignore and NOT snooze restricted URLs', async () => {
      const restrictedTab = { id: 99, url: 'chrome://extensions', title: 'Extensions' };
      const popTime = Date.now() + 3600000;

      (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockClear();
      (chrome.tabs.remove as ReturnType<typeof vi.fn>).mockClear();

      await snooze(restrictedTab, popTime);

      expect(chrome.storage.local.set).not.toHaveBeenCalled();
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });
  });

  describe('popCheck (Restoration Safety)', () => {
    // Helper to run popCheck with timer advancement for retry logic
    async function runPopCheckWithTimers(totalDelayMs = 700) {
      const popCheckPromise = popCheck();
      for (let elapsed = 0; elapsed < totalDelayMs; elapsed += 50) {
        await vi.advanceTimersByTimeAsync(50);
      }
      await vi.runAllTimersAsync();
      return popCheckPromise;
    }

    it('should NOT remove tabs from storage if restoration fails', async () => {
      const now = Date.now();
      const pastTime = now - 1000;
      const id = 't1';
      const item = createItem(id, pastTime);

      mockStorage = createV2Data({ [id]: item }, { [pastTime]: [id] });
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockStorage);

      // Failures - all retries will fail
      (chrome.tabs.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed tab'));
      (chrome.windows.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed win'));
      (chrome.windows.getLastFocused as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 999 });

      await runPopCheckWithTimers();

      // Tab should still exist (rescheduled to future time after failed retries)
      const mockCalls = (chrome.storage.local.set as ReturnType<typeof vi.fn>).mock.calls as Array<[Record<string, unknown>]>;
      const v2SetCalls = mockCalls.filter((c) => c[0].snoooze_v2);
      if (v2SetCalls.length > 0) {
        const lastV2Call = v2SetCalls[v2SetCalls.length - 1][0].snoooze_v2 as TestStorageV2;
        expect(lastV2Call.items[id]).toBeDefined();
      }
    });
  });

  it('should handle storage failure gracefully even if tab is removed', async () => {
    const tab = { id: 1, url: 'http://test.com', title: 'Test' };
    const popTime = Date.now() + 3600000;

    (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Storage full'));
    (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue(createV2Data());

    await expect(snooze(tab, popTime)).rejects.toThrow();
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
  });

  it('should correctly cleanup ONLY successfully restored tabs', async () => {
      // Helper to run popCheck with timer advancement for retry logic
      async function runPopCheckWithTimers(totalDelayMs = 700) {
        const popCheckPromise = popCheck();
        for (let elapsed = 0; elapsed < totalDelayMs; elapsed += 50) {
          await vi.advanceTimersByTimeAsync(50);
        }
        await vi.runAllTimersAsync();
        return popCheckPromise;
      }

      const now = Date.now();
      const pastTime = now - 1000;

      const i1 = createItem('t1', pastTime, { url: 'http://ok.com' });
      const i2 = createItem('t2', pastTime, { url: 'http://fail.com' });

      mockStorage = createV2Data(
          { 't1': i1, 't2': i2 },
          { [pastTime]: ['t1', 't2'] }
      );
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockStorage);
      (chrome.windows.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 100 });
      (chrome.windows.getLastFocused as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 100 });

      // Succeed for t1 always, Fail for t2 always (all retries will fail)
      (chrome.tabs.create as ReturnType<typeof vi.fn>).mockImplementation((opts: { url?: string }) => {
          if (opts.url === 'http://ok.com') return Promise.resolve({});
          return Promise.reject(new Error('Failed'));
      });

      await runPopCheckWithTimers();

      const mockCalls = (chrome.storage.local.set as ReturnType<typeof vi.fn>).mock.calls as Array<[Record<string, unknown>]>;
      const v2SetCalls = mockCalls.filter((c) => c[0].snoooze_v2);
      expect(v2SetCalls.length).toBeGreaterThan(0);

      // Find the final state - t1 removed, t2 rescheduled (still exists)
      const lastV2Call = v2SetCalls[v2SetCalls.length - 1][0].snoooze_v2 as TestStorageV2;
      expect(lastV2Call.items['t1']).toBeUndefined();
      expect(lastV2Call.items['t2']).toBeDefined();
  });

  it('should NOT remove tabs from storage if window creation partially fails', async () => {
      // Helper to run popCheck with timer advancement for retry logic
      async function runPopCheckWithTimers(totalDelayMs = 700) {
        const popCheckPromise = popCheck();
        for (let elapsed = 0; elapsed < totalDelayMs; elapsed += 50) {
          await vi.advanceTimersByTimeAsync(50);
        }
        await vi.runAllTimersAsync();
        return popCheckPromise;
      }

      const now = Date.now();
      const pastTime = now - 1000;
      const groupId = 'g1';

      const i1 = createItem('t1', pastTime, { groupId });
      const i2 = createItem('t2', pastTime, { groupId }); // Ignored by partial restore

      mockStorage = createV2Data(
          { 't1': i1, 't2': i2 },
          { [pastTime]: ['t1', 't2'] }
      );
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockStorage);

      // Partial success - only 1 tab created instead of 2 (all retries will fail validation)
      (chrome.windows.create as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 100,
          tabs: [{ id: 101, url: TAB_URL }] // Only 1 tab
      });

      await runPopCheckWithTimers();

      // Ensure both preserved (rescheduled after failed retries)
      const mockCalls = (chrome.storage.local.set as ReturnType<typeof vi.fn>).mock.calls as Array<[Record<string, unknown>]>;
      const v2SetCalls = mockCalls.filter((c) => c[0].snoooze_v2);
      if (v2SetCalls.length > 0) {
          const lastV2Call = v2SetCalls[v2SetCalls.length - 1][0].snoooze_v2 as TestStorageV2;
          expect(lastV2Call.items['t1']).toBeDefined();
          expect(lastV2Call.items['t2']).toBeDefined();
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
          (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockStorage);

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
          (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockStorage);

          const result = await recoverFromBackup();

          expect(result.recovered).toBe(true);
          expect(result.sanitized).toBe(true);
          expect(result.tabCount).toBe(1); // Should pick Backup B

          // Should save the sanitized version of B with version field
          const expectedSaved = {
              version: 2,
              items: { 't2': item2 },
              schedule: { [MOCK_TIME]: ['t2'] }
          };
          expect(chrome.storage.local.set).toHaveBeenCalledWith(
              expect.objectContaining({ snoooze_v2: expectedSaved })
          );
      });

      it('should add version field when recovering from sanitized backup', async () => {
          const item = createItem('t1', MOCK_TIME);
          // Mock backup without version field (will need sanitization due to orphaned reference)
          const backupWithoutVersion = {
              items: { 't1': item },
              schedule: { [MOCK_TIME]: ['t1', 'orphaned-id'] } // Has orphaned reference, needs sanitization
          };

          mockStorage = {
              snoooze_v2: null, // Corrupted main storage
              snoozedTabs_backup_1234567890: backupWithoutVersion
          };
          (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockStorage);

          await recoverFromBackup();

          // Check that set was called with version: 2
          expect(chrome.storage.local.set).toHaveBeenCalledWith({
              snoooze_v2: expect.objectContaining({
                  version: 2,
                  items: expect.any(Object),
                  schedule: expect.any(Object)
              })
          });
      });
  });

});
