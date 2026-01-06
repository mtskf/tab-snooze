import { describe, test, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
  checkStorageSize,
  getSnoozedTabsV2,
  setSnoozedTabs,
  initStorage,
  snooze,
  popCheck,
  removeSnoozedTabWrapper,
  removeWindowGroup,
  getSettings,
  importTabs,
  getExportData,
} from './snoozeLogic';
import type { SnoozedItemV2 } from '../types';

// Type for V2 storage data in tests (version is optional for flexibility)
interface TestStorageV2 {
  version?: number;
  items: Record<string, SnoozedItemV2>;
  schedule: Record<string, string[]>;
}

vi.mock('../utils/uuid', async (importOriginal) => {
  const actual = await importOriginal() as { generateUUID: () => string };
  return {
    ...actual,
    generateUUID: vi.fn(actual.generateUUID),
  };
});

import { generateUUID } from '../utils/uuid';

// Mocks
const chromeMock = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      getBytesInUse: vi.fn().mockResolvedValue(100),
    },
    session: {
      set: vi.fn(),
    },
  },
  tabs: {
    remove: vi.fn(),
    create: vi.fn(),
  },
  windows: {
    create: vi.fn(),
    getLastFocused: vi.fn(),
    remove: vi.fn(),
  },
  notifications: {
      create: vi.fn()
  },
  action: {
      setBadgeText: vi.fn(),
      setBadgeBackgroundColor: vi.fn()
  }
};


// Helpers
const MOCK_TIME = 1625097600000;
const TAB_URL = 'https://example.com';
const TAB_TITLE = 'Example';

const createV2Data = (items: Record<string, SnoozedItemV2> = {}, schedule: Record<string, string[]> = {}): { snoooze_v2: TestStorageV2 } => ({
  snoooze_v2: { items, schedule }
});

const createItem = (id: string, popTime: number, overrides: Partial<SnoozedItemV2> = {}): SnoozedItemV2 => ({
  id,
  url: TAB_URL,
  title: TAB_TITLE,
  creationTime: MOCK_TIME - 3600000,
  popTime,
  ...overrides
});

describe('snoozeLogic.js (V2)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(MOCK_TIME);

        // Setup globals
        vi.stubGlobal('chrome', chromeMock);
        vi.stubGlobal('navigator', { onLine: true });

        // Default empty storage
        chromeMock.storage.local.get.mockResolvedValue(createV2Data());
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    test('initStorage - fresh install initializes empty V2', async () => {
        chromeMock.storage.local.get.mockResolvedValue({});
        await initStorage();
        expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
            expect.objectContaining({
                snoooze_v2: { version: 2, items: {}, schedule: {} }
            })
        );
    });

    test('initStorage - migration from legacy', async () => {
        const legacy = {
            snoozedTabs: {
                [MOCK_TIME]: [{ url: TAB_URL, creationTime: 123, index: 0 }],
                tabCount: 1
            }
        };
        chromeMock.storage.local.get.mockResolvedValue(legacy);

        await initStorage();

        // Should save V2
        expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
            expect.objectContaining({
                snoooze_v2: expect.objectContaining({
                    items: expect.any(Object),
                    schedule: expect.any(Object)
                })
            })
        );
        // Verify backup
        expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
            expect.objectContaining({
                snoozedTabs_legacy_backup: legacy.snoozedTabs
            })
        );
    });

    test('initStorage - migration resolves duplicate tab ids', async () => {
        const legacy = {
            snoozedTabs: {
                [MOCK_TIME]: [
                    { id: 'dup-id', url: TAB_URL, creationTime: 123, index: 0 },
                    { id: 'dup-id', url: 'https://example.com/2', creationTime: 124, index: 1 }
                ],
                tabCount: 2
            }
        };
        chromeMock.storage.local.get.mockResolvedValue(legacy);

        const originalImpl = (generateUUID as Mock).getMockImplementation() ?? (() => crypto.randomUUID());
        (generateUUID as Mock).mockImplementation(() => 'new-id');

        await initStorage();

        const mockCalls = chromeMock.storage.local.set.mock.calls as Array<[Record<string, unknown>]>;
        const v2Call = mockCalls.find((call) => call[0].snoooze_v2);
        expect(v2Call).toBeTruthy();

        const { items, schedule } = v2Call![0].snoooze_v2 as TestStorageV2;
        expect(Object.keys(items)).toHaveLength(2);
        expect(Object.keys(items)).toEqual(expect.arrayContaining(['dup-id', 'new-id']));
        expect(schedule[MOCK_TIME]).toEqual(expect.arrayContaining(['dup-id', 'new-id']));

        (generateUUID as Mock).mockImplementation(originalImpl);
    });

    test('snooze - saves to V2 items and schedule w/ ID', async () => {
        const popTime = MOCK_TIME + 3600000;
        const tab = { url: TAB_URL, title: TAB_TITLE, index: 0, id: 99 };

        await snooze(tab, popTime);

        expect(chromeMock.storage.local.set).toHaveBeenCalled();
        const callArg = chromeMock.storage.local.set.mock.calls[0][0] as { snoooze_v2: TestStorageV2 };
        expect(callArg.snoooze_v2).toBeDefined();

        const ids = Object.keys(callArg.snoooze_v2.items);
        expect(ids.length).toBe(1);
        expect(callArg.snoooze_v2.schedule[popTime]).toContain(ids[0]);
    });

    test('popCheck - restores valid tabs from V2', async () => {
        const popTime = MOCK_TIME - 1000; // Past
        const id = 'tab-1';
        const item = createItem(id, popTime);

        chromeMock.storage.local.get.mockResolvedValue(createV2Data(
            { [id]: item },
            { [popTime]: [id] }
        ));

        chromeMock.windows.getLastFocused.mockResolvedValue({ id: 999 });

        await popCheck();

        expect(chromeMock.tabs.create).toHaveBeenCalledWith(
            expect.objectContaining({ url: TAB_URL, windowId: 999 })
        );

        // Verify cleanup
        expect(chromeMock.storage.local.set).toHaveBeenCalled();
        const lastCall = chromeMock.storage.local.set.mock.lastCall;
        expect(lastCall).toBeDefined();
        const verifyCall = lastCall![0] as { snoooze_v2: TestStorageV2 };
        expect(verifyCall.snoooze_v2.items[id]).toBeUndefined();
    });

    test('popCheck - returns early when offline', async () => {
        vi.stubGlobal('navigator', { onLine: false });

        const result = await popCheck();

        expect(result).toBe(0);
        expect(chromeMock.storage.local.get).not.toHaveBeenCalled();
    });

    test('removeSnoozedTabWrapper - removes from V2 by ID', async () => {
        const popTime = MOCK_TIME + 10000;
        const id = 'tab-rem';
        const item = createItem(id, popTime);

        chromeMock.storage.local.get.mockResolvedValue(createV2Data(
            { [id]: item },
            { [popTime]: [id] }
        ));

        // Test with minimal data - full item exists in storage
        await removeSnoozedTabWrapper({ id: id } as unknown as SnoozedItemV2);

        expect(chromeMock.storage.local.set).toHaveBeenCalled();
        const lastCall = chromeMock.storage.local.set.mock.lastCall;
        expect(lastCall).toBeDefined();
        const setCall = lastCall![0] as { snoooze_v2: TestStorageV2 };
        expect(setCall.snoooze_v2.items[id]).toBeUndefined();
    });

    test('RESTRICTED_PROTOCOLS prevent saving', async () => {
        const popTime = MOCK_TIME + 1000;
        const tab = { url: 'chrome://settings', title: 'Settings', id: 1 };

        await snooze(tab, popTime);

        // Should NOT save
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
        // Should NOT close info tab
        expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });

    // Keeping Storage Size Check tests as is (uses mocked getBytesInUse)
    describe('checkStorageSize', () => {
        const STORAGE_LIMIT = 10 * 1024 * 1024;
        const WARNING_THRESHOLD = 0.8 * STORAGE_LIMIT;

        test('should warn when threshold exceeded', async () => {
             chromeMock.storage.local.getBytesInUse.mockResolvedValue(WARNING_THRESHOLD + 100);
             chromeMock.storage.local.get.mockResolvedValue({}); // active: false

             await checkStorageSize();

             expect(chrome.notifications.create).toHaveBeenCalled();
        });
    });

    describe('getSettings (V2)', () => {
        test('merges default settings with saved settings', async () => {
            // Mock saved settings having one key but missing others
            chromeMock.storage.local.get.mockResolvedValue({
                settings: { 'start-day': '9:00 AM' }
            });

            // Mock Intl for timezone
            vi.stubGlobal('Intl', {
                DateTimeFormat: () => ({
                    resolvedOptions: () => ({ timeZone: 'Mock/Zone' })
                })
            });

            const settings = await getSettings();

            // Existing key preserved
            expect(settings['start-day']).toBe('9:00 AM');
            // Missing key filled from defaults (assuming 'end-day' is in DEFAULT_SETTINGS)
            expect(settings['end-day']).toBe('5:00 PM');
            // Timezone injected
            expect(settings.timezone).toBe('Mock/Zone');


        });

        test('returns full defaults if settings is undefined', async () => {
            chromeMock.storage.local.get.mockResolvedValue({});

             // Mock Intl for timezone
            vi.stubGlobal('Intl', {
                DateTimeFormat: () => ({
                    resolvedOptions: () => ({ timeZone: 'Mock/Zone' })
                })
            });

            const settings = await getSettings();

            expect(settings['start-day']).toBe('8:00 AM'); // Default
            expect(settings.timezone).toBe('Mock/Zone');


        });
    });

    describe('getSnoozedTabsV2 validation', () => {
        test('sanitizes invalid schedule references and persists', async () => {
            const popTime = MOCK_TIME - 1000;
            const id = 'tab-1';
            const item = createItem(id, popTime);
            const invalidV2 = {
                snoooze_v2: {
                    items: { [id]: item },
                    schedule: { [popTime]: [id, 'missing-id'] }
                }
            };
            chromeMock.storage.local.get.mockResolvedValue(invalidV2);

            const result = await getSnoozedTabsV2();

            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    snoooze_v2: expect.objectContaining({
                        items: { [id]: item },
                        schedule: { [popTime]: [id] }
                    })
                })
            );
            expect(result.items[id]).toBeDefined();
            expect(result.schedule[popTime]).toEqual([id]);
        });

        test('should add version field when sanitizing invalid data', async () => {
            const popTime = MOCK_TIME + 1000;
            const id = 'uuid-1';
            const item = createItem(id, popTime);
            // Mock corrupted V2 data (valid items but missing version)
            const corruptedData = {
                snoooze_v2: {
                    items: { [id]: item },
                    schedule: { [popTime]: [id, 'missing-id'] } // Invalid: has orphaned reference
                    // No version field
                }
            };

            chromeMock.storage.local.get.mockResolvedValue(corruptedData);

            await getSnoozedTabsV2();

            // Check that set was called with version: 2
            expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
                snoooze_v2: expect.objectContaining({
                    version: 2,
                    items: expect.any(Object),
                    schedule: expect.any(Object)
                })
            });
        });
    });

    describe('getStorageV2 defensive handling', () => {
        test('getSnoozedTabsV2 handles missing items property', async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: { schedule: { '123456': ['id-1'] } }
            });

            const result = await getSnoozedTabsV2();

            expect(result).toEqual({ version: 2, items: {}, schedule: {} });
        });

        test('getSnoozedTabsV2 handles missing schedule property', async () => {
            const popTime = MOCK_TIME + 1000;
            const id = 'tab-1';
            const item = createItem(id, popTime);
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: { items: { [id]: item } }
            });

            const result = await getSnoozedTabsV2();

            // Items are preserved, only schedule is empty
            expect(result).toEqual({ version: 2, items: { [id]: item }, schedule: {} });
        });

        test('getSnoozedTabsV2 handles both items and schedule missing', async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: {}
            });

            const result = await getSnoozedTabsV2();

            expect(result).toEqual({ version: 2, items: {}, schedule: {} });
        });

        test('getSnoozedTabsV2 handles null items', async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: { items: null, schedule: {} }
            });

            const result = await getSnoozedTabsV2();

            expect(result).toEqual({ version: 2, items: {}, schedule: {} });
        });

        test('getSnoozedTabsV2 handles null schedule', async () => {
            const popTime = MOCK_TIME + 1000;
            const id = 'tab-1';
            const item = createItem(id, popTime);
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: { items: { [id]: item }, schedule: null }
            });

            const result = await getSnoozedTabsV2();

            // Items are preserved, only schedule is empty
            expect(result).toEqual({ version: 2, items: { [id]: item }, schedule: {} });
        });

        test('popCheck handles corrupted storage without crashing', async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: { items: null, schedule: undefined }
            });

            const result = await popCheck();

            expect(result).toEqual({ count: 0 });
        });

        test('getSnoozedTabsV2 handles items as array (invalid)', async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: { items: ['invalid'], schedule: {} }
            });

            const result = await getSnoozedTabsV2();

            expect(result).toEqual({ version: 2, items: {}, schedule: {} });
        });

        test('getSnoozedTabsV2 handles schedule as array (invalid)', async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: { items: {}, schedule: ['invalid'] }
            });

            const result = await getSnoozedTabsV2();

            expect(result).toEqual({ version: 2, items: {}, schedule: {} });
        });

        test('getSnoozedTabsV2 handles snoooze_v2 as array (invalid)', async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: ['invalid']
            });

            const result = await getSnoozedTabsV2();

            expect(result).toEqual({ version: 2, items: {}, schedule: {} });
        });
    });

    describe('restoreTabs retry logic', () => {
        const RETRY_DELAY_MS = 200;
        const MAX_RETRIES = 3;
        const RESCHEDULE_DELAY_MS = 5 * 60 * 1000; // 5 minutes

        // Helper to run popCheck with timer advancement
        async function runPopCheckWithTimers(totalDelayMs = RETRY_DELAY_MS * MAX_RETRIES) {
            const popCheckPromise = popCheck();
            // Advance time in small increments to allow async operations to interleave
            for (let elapsed = 0; elapsed < totalDelayMs; elapsed += 50) {
                await vi.advanceTimersByTimeAsync(50);
            }
            await vi.runAllTimersAsync();
            return popCheckPromise;
        }

        test('should retry tab creation up to 3 times on failure', async () => {
            const popTime = MOCK_TIME - 1000;
            const id = 'retry-tab';
            const item = createItem(id, popTime);

            chromeMock.storage.local.get.mockResolvedValue(createV2Data(
                { [id]: item },
                { [popTime]: [id] }
            ));

            chromeMock.windows.getLastFocused.mockResolvedValue({ id: 999 });
            // Fail twice, succeed on third attempt
            chromeMock.tabs.create
                .mockRejectedValueOnce(new Error('Tab creation failed'))
                .mockRejectedValueOnce(new Error('Tab creation failed'))
                .mockResolvedValueOnce({ id: 1 });

            await runPopCheckWithTimers();

            // Should have been called 3 times total
            expect(chromeMock.tabs.create).toHaveBeenCalledTimes(3);
        });

        test('should wait 200ms between retries', async () => {
            const popTime = MOCK_TIME - 1000;
            const id = 'retry-delay-tab';
            const item = createItem(id, popTime);

            chromeMock.storage.local.get.mockResolvedValue(createV2Data(
                { [id]: item },
                { [popTime]: [id] }
            ));

            chromeMock.windows.getLastFocused.mockResolvedValue({ id: 999 });
            chromeMock.tabs.create
                .mockRejectedValueOnce(new Error('Failed'))
                .mockResolvedValueOnce({ id: 1 });

            await runPopCheckWithTimers(RETRY_DELAY_MS * 2);

            expect(chromeMock.tabs.create).toHaveBeenCalledTimes(2);
        });

        test('should remove tab from storage after successful retry', async () => {
            const popTime = MOCK_TIME - 1000;
            const id = 'retry-success-tab';
            const item = createItem(id, popTime);

            chromeMock.storage.local.get.mockResolvedValue(createV2Data(
                { [id]: item },
                { [popTime]: [id] }
            ));

            chromeMock.windows.getLastFocused.mockResolvedValue({ id: 999 });
            chromeMock.tabs.create
                .mockRejectedValueOnce(new Error('Failed'))
                .mockResolvedValueOnce({ id: 1 });

            await runPopCheckWithTimers(RETRY_DELAY_MS * 2);

            // Find the call that saved snoooze_v2
            const mockCalls1 = chromeMock.storage.local.set.mock.calls as Array<[Record<string, unknown>]>;
            const v2SetCall = mockCalls1.find((call) => call[0].snoooze_v2);
            expect(v2SetCall).toBeDefined();
            expect((v2SetCall![0].snoooze_v2 as TestStorageV2).items[id]).toBeUndefined();
            expect((v2SetCall![0].snoooze_v2 as TestStorageV2).schedule[popTime]).toBeUndefined();
        });

        test('should reschedule tab to future time after all retries fail', async () => {
            const popTime = MOCK_TIME - 1000;
            const id = 'all-retries-fail-tab';
            const item = createItem(id, popTime);

            chromeMock.storage.local.get.mockResolvedValue(createV2Data(
                { [id]: item },
                { [popTime]: [id] }
            ));

            chromeMock.windows.getLastFocused.mockResolvedValue({ id: 999 });
            chromeMock.tabs.create.mockRejectedValue(new Error('Permanent failure'));

            await runPopCheckWithTimers();

            // Find the last call that saved snoooze_v2 (reschedule happens after cleanup)
            const mockCalls = chromeMock.storage.local.set.mock.calls as Array<[Record<string, unknown>]>;
            const v2SetCalls = mockCalls.filter((call) => call[0].snoooze_v2);
            expect(v2SetCalls.length).toBeGreaterThan(0);
            const lastV2Call = v2SetCalls[v2SetCalls.length - 1][0] as { snoooze_v2: TestStorageV2 };

            // Tab should be rescheduled approximately 5 minutes from current time
            // Allow for timer drift during test execution
            expect(lastV2Call.snoooze_v2.items[id]).toBeDefined();
            const actualNewPopTime = lastV2Call.snoooze_v2.items[id].popTime;
            expect(actualNewPopTime).toBeGreaterThanOrEqual(MOCK_TIME + RESCHEDULE_DELAY_MS);
            expect(actualNewPopTime).toBeLessThan(MOCK_TIME + RESCHEDULE_DELAY_MS + 1000);
            expect(lastV2Call.snoooze_v2.schedule[actualNewPopTime]).toContain(id);
            // Old schedule entry should be removed
            expect(lastV2Call.snoooze_v2.schedule[popTime]).toBeUndefined();
        });

        test('should show notification when tabs fail to restore after all retries', async () => {
            const popTime = MOCK_TIME - 1000;
            const id = 'notify-fail-tab';
            const item = createItem(id, popTime);

            chromeMock.storage.local.get.mockResolvedValue(createV2Data(
                { [id]: item },
                { [popTime]: [id] }
            ));

            chromeMock.windows.getLastFocused.mockResolvedValue({ id: 999 });
            chromeMock.tabs.create.mockRejectedValue(new Error('Permanent failure'));

            await runPopCheckWithTimers();

            expect(chromeMock.notifications.create).toHaveBeenCalledWith(
                'restore-failed',
                expect.objectContaining({
                    type: 'basic',
                    title: expect.stringContaining('restore'),
                    message: expect.any(String)
                })
            );
        });

        test('should store failed tab info for Dialog display', async () => {
            const popTime = MOCK_TIME - 1000;
            const id = 'store-fail-info-tab';
            const item = createItem(id, popTime, { title: 'Failed Tab Title' });

            chromeMock.storage.local.get.mockResolvedValue(createV2Data(
                { [id]: item },
                { [popTime]: [id] }
            ));

            chromeMock.windows.getLastFocused.mockResolvedValue({ id: 999 });
            chromeMock.tabs.create.mockRejectedValue(new Error('Permanent failure'));

            await runPopCheckWithTimers();

            // Failed tabs info should be stored in session storage
            expect(chromeMock.storage.session.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    failedRestoreTabs: expect.arrayContaining([
                        expect.objectContaining({ id, title: 'Failed Tab Title' })
                    ])
                })
            );
        });

        test('should retry group window creation on failure', async () => {
            const popTime = MOCK_TIME - 1000;
            const groupId = 'test-group';
            const items = {
                'g1': createItem('g1', popTime, { groupId, index: 0 }),
                'g2': createItem('g2', popTime, { groupId, index: 1 })
            };

            chromeMock.storage.local.get.mockResolvedValue(createV2Data(
                items,
                { [popTime]: ['g1', 'g2'] }
            ));

            chromeMock.windows.create
                .mockRejectedValueOnce(new Error('Window creation failed'))
                .mockResolvedValueOnce({ id: 100, tabs: [{ id: 1 }, { id: 2 }] });

            await runPopCheckWithTimers(RETRY_DELAY_MS * 2);

            expect(chromeMock.windows.create).toHaveBeenCalledTimes(2);
        });

        test('should cleanup partial window before retry on validation failure', async () => {
            const popTime = MOCK_TIME - 1000;
            const groupId = 'cleanup-group';
            const items = {
                'g1': createItem('g1', popTime, { groupId, index: 0 }),
                'g2': createItem('g2', popTime, { groupId, index: 1 })
            };

            chromeMock.storage.local.get.mockResolvedValue(createV2Data(
                items,
                { [popTime]: ['g1', 'g2'] }
            ));

            // First attempt: partial restore (1 tab instead of 2)
            // Second attempt: success
            chromeMock.windows.create
                .mockResolvedValueOnce({ id: 200, tabs: [{ id: 1 }] }) // Partial - only 1 tab
                .mockResolvedValueOnce({ id: 201, tabs: [{ id: 2 }, { id: 3 }] }); // Success - 2 tabs

            await runPopCheckWithTimers(RETRY_DELAY_MS * 2);

            // Should have closed the partial window before retrying
            expect(chromeMock.windows.remove).toHaveBeenCalledWith(200);
            expect(chromeMock.windows.create).toHaveBeenCalledTimes(2);
        });
    });

    describe('setSnoozedTabs', () => {
        test('should overwrite existing V2 data with provided legacy data', async () => {
            // Existing V2 data in storage
            const existingV2 = {
                version: 2,
                items: { 'old-id': { id: 'old-id', url: 'https://old.com', popTime: 999, creationTime: 900 } },
                schedule: { '999': ['old-id'] }
            };

            // New legacy data to import
            const newLegacyData = {
                tabCount: 1,
                [MOCK_TIME]: [{ url: TAB_URL, creationTime: 123 }]
            };

            // Mock storage.get to return existing V2 data
            chromeMock.storage.local.get.mockImplementation((keys: string | string[] | null) => {
                if (keys === null) {
                    return Promise.resolve({ snoooze_v2: existingV2 });
                }
                if (keys === 'snoooze_v2') {
                    return Promise.resolve({ snoooze_v2: existingV2 });
                }
                if (Array.isArray(keys) && keys.includes('snoozedTabs')) {
                    return Promise.resolve({ snoozedTabs: newLegacyData });
                }
                return Promise.resolve({});
            });

            await setSnoozedTabs(newLegacyData);

            // Should have saved V2 data derived from newLegacyData, not existingV2
            const mockCalls = chromeMock.storage.local.set.mock.calls as Array<[Record<string, unknown>]>;
            const setCall = mockCalls.find((call) => call[0].snoooze_v2);
            expect(setCall).toBeTruthy();

            const savedV2 = setCall![0].snoooze_v2 as TestStorageV2;
            expect(savedV2.version).toBe(2);

            // Should contain tab from newLegacyData with TAB_URL
            const itemIds = Object.keys(savedV2.items);
            expect(itemIds.length).toBe(1);
            expect(savedV2.items[itemIds[0]].url).toBe(TAB_URL);

            // Should NOT contain old data
            expect(savedV2.items['old-id']).toBeUndefined();
        });

        test('should handle empty legacy data', async () => {
            chromeMock.storage.local.get.mockResolvedValue({});

            await setSnoozedTabs({ tabCount: 0 });

            const mockCalls = chromeMock.storage.local.set.mock.calls as Array<[Record<string, unknown>]>;
            const setCall = mockCalls.find((call) => call[0].snoooze_v2);
            expect(setCall).toBeTruthy();
            expect(setCall![0].snoooze_v2).toEqual({
                version: 2,
                items: {},
                schedule: {}
            });
        });

        test('should add version field to V2 data without version', async () => {
            chromeMock.storage.local.get.mockResolvedValue({});

            // V2 data without version field
            const v2DataWithoutVersion = {
                items: { 'id-1': { id: 'id-1', url: TAB_URL, popTime: MOCK_TIME, creationTime: 100 } },
                schedule: { [MOCK_TIME]: ['id-1'] }
            };

            await setSnoozedTabs(v2DataWithoutVersion);

            const mockCalls = chromeMock.storage.local.set.mock.calls as Array<[Record<string, unknown>]>;
            const setCall = mockCalls.find((call) => call[0].snoooze_v2);
            expect(setCall).toBeTruthy();

            const savedV2 = setCall![0].snoooze_v2 as TestStorageV2;
            expect(savedV2.version).toBe(2); // Version should be added
            expect(savedV2.items).toEqual(v2DataWithoutVersion.items);
            expect(savedV2.schedule).toEqual(v2DataWithoutVersion.schedule);
        });

        test('should reject future schema versions', async () => {
            chromeMock.storage.local.get.mockResolvedValue({});

            // Future schema version
            const futureData = {
                version: 3,
                items: {},
                schedule: {},
                newField: {}
            };

            await expect(setSnoozedTabs(futureData)).rejects.toThrow(
                'Cannot import data from future schema version 3'
            );
        });
    });

    describe('getSnoozedTabsV2', () => {
        test('returns valid V2 data as-is', async () => {
            const popTime = MOCK_TIME + 1000;
            const id = 'tab-1';
            const item = createItem(id, popTime);
            const validV2 = {
                snoooze_v2: {
                    version: 2,
                    items: { [id]: item },
                    schedule: { [popTime]: [id] }
                }
            };
            chromeMock.storage.local.get.mockResolvedValue(validV2);

            const result = await getSnoozedTabsV2();

            expect(result).toEqual(validV2.snoooze_v2);
            // Should not call set (no sanitization needed)
            expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
        });

        test('sanitizes invalid V2 data and persists', async () => {
            const popTime = MOCK_TIME + 1000;
            const id = 'tab-1';
            const item = createItem(id, popTime);
            const invalidV2 = {
                snoooze_v2: {
                    version: 2,
                    items: { [id]: item },
                    schedule: { [popTime]: [id, 'missing-id'] } // orphaned reference
                }
            };
            chromeMock.storage.local.get.mockResolvedValue(invalidV2);

            const result = await getSnoozedTabsV2();

            // Should return sanitized V2 data
            expect(result.version).toBe(2);
            expect(result.items).toEqual({ [id]: item });
            expect(result.schedule[popTime]).toEqual([id]); // missing-id removed

            // Should have persisted sanitized data
            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    snoooze_v2: expect.objectContaining({
                        version: 2,
                        schedule: { [popTime]: [id] }
                    })
                })
            );
        });

        test('returns empty V2 structure for missing data', async () => {
            chromeMock.storage.local.get.mockResolvedValue({});

            const result = await getSnoozedTabsV2();

            expect(result).toEqual({
                version: 2,
                items: {},
                schedule: {}
            });
        });

        test('adds version field when missing', async () => {
            const popTime = MOCK_TIME + 1000;
            const id = 'tab-1';
            const item = createItem(id, popTime);
            const v2WithoutVersion = {
                snoooze_v2: {
                    items: { [id]: item },
                    schedule: { [popTime]: [id] }
                }
            };
            chromeMock.storage.local.get.mockResolvedValue(v2WithoutVersion);

            const result = await getSnoozedTabsV2();

            expect(result.version).toBe(2);
            expect(result.items).toEqual({ [id]: item });
        });
    });

    describe('importTabs', () => {
        test('imports V2 data and merges with existing data', async () => {
            // Existing data
            const existingItem = createItem('existing-1', MOCK_TIME + 1000);
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: {
                    version: 2,
                    items: { 'existing-1': existingItem },
                    schedule: { [MOCK_TIME + 1000]: ['existing-1'] }
                }
            });

            // Import data
            const importItem = createItem('import-1', MOCK_TIME + 2000);
            const importData = {
                version: 2,
                items: { 'import-1': importItem },
                schedule: { [MOCK_TIME + 2000]: ['import-1'] }
            };

            const result = await importTabs(importData);

            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(1);

            // Should merge both items
            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    snoooze_v2: expect.objectContaining({
                        version: 2,
                        items: expect.objectContaining({
                            'existing-1': existingItem,
                            'import-1': importItem
                        })
                    })
                })
            );
        });

        test('imports V1 data by migrating to V2 first', async () => {
            // Empty existing data
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: { version: 2, items: {}, schedule: {} }
            });

            // V1 format data
            const v1Data = {
                tabCount: 1,
                [MOCK_TIME + 1000]: [{
                    url: TAB_URL,
                    title: TAB_TITLE,
                    creationTime: MOCK_TIME - 3600000,
                    popTime: MOCK_TIME + 1000
                }]
            };

            const result = await importTabs(v1Data);

            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(1);

            // Should save V2 format
            expect(chromeMock.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    snoooze_v2: expect.objectContaining({
                        version: 2,
                        items: expect.any(Object),
                        schedule: expect.any(Object)
                    })
                })
            );
        });

        test('generates new UUID when ID collision occurs', async () => {
            const popTime = MOCK_TIME + 1000;
            const existingItem = createItem('collision-id', popTime);

            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: {
                    version: 2,
                    items: { 'collision-id': existingItem },
                    schedule: { [popTime]: ['collision-id'] }
                }
            });

            // Import data with same ID
            const importItem = createItem('collision-id', MOCK_TIME + 2000, { title: 'New Title' });
            const importData = {
                version: 2,
                items: { 'collision-id': importItem },
                schedule: { [MOCK_TIME + 2000]: ['collision-id'] }
            };

            // Mock UUID to return predictable value
            (generateUUID as Mock).mockReturnValueOnce('new-unique-id');

            const result = await importTabs(importData);

            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(1);

            // Should have generated new UUID
            expect(generateUUID).toHaveBeenCalled();

            // Should save with both items (original + renamed)
            const mockCalls = chromeMock.storage.local.set.mock.calls as Array<[Record<string, unknown>]>;
            const setCall = mockCalls.find((call) => call[0].snoooze_v2);
            expect(setCall).toBeTruthy();
            const savedData = setCall![0].snoooze_v2 as TestStorageV2;
            expect(Object.keys(savedData.items)).toHaveLength(2);
            expect(savedData.items['collision-id']).toEqual(existingItem);
            expect(savedData.items['new-unique-id']).toBeDefined();
            expect(savedData.items['new-unique-id'].title).toBe('New Title');
        });

        test('sanitizes invalid V2 import data', async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: { version: 2, items: {}, schedule: {} }
            });

            // Invalid V2 data (schedule references non-existent item)
            const importData = {
                version: 2,
                items: {
                    'valid-tab': createItem('valid-tab', MOCK_TIME + 1000)
                },
                schedule: {
                    [MOCK_TIME + 1000]: ['valid-tab', 'non-existent']
                }
            };

            const result = await importTabs(importData);

            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(1);

            // Schedule should not contain non-existent item
            const mockCalls = chromeMock.storage.local.set.mock.calls as Array<[Record<string, unknown>]>;
            const setCall = mockCalls.find((call) => call[0].snoooze_v2);
            expect(setCall).toBeTruthy();
            const savedSchedule = (setCall![0].snoooze_v2 as TestStorageV2).schedule;
            expect(savedSchedule[MOCK_TIME + 1000]).toEqual(['valid-tab']);
        });

        test('returns zero addedCount for empty import data', async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: { version: 2, items: {}, schedule: {} }
            });

            const result = await importTabs({ version: 2, items: {}, schedule: {} });

            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(0);
        });

        test('rejects invalid data structure', async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: { version: 2, items: {}, schedule: {} }
            });

            const result = await importTabs(['not', 'an', 'object']);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('rejects future schema version', async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: { version: 2, items: {}, schedule: {} }
            });

            // Data with a future version
            const futureData = {
                version: 99,
                items: { 'tab-1': createItem('tab-1', MOCK_TIME + 1000) },
                schedule: { [MOCK_TIME + 1000]: ['tab-1'] }
            };

            const result = await importTabs(futureData);

            expect(result.success).toBe(false);
            expect(result.error).toContain('future schema version');
        });

        test('handles null input gracefully', async () => {
            const result = await importTabs(null);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid data structure');
        });

        test('handles undefined input gracefully', async () => {
            const result = await importTabs(undefined);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid data structure');
        });

        test('returns success with zero count for null version detection', async () => {
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: { version: 2, items: {}, schedule: {} }
            });

            // Empty object that has no recognizable schema
            const result = await importTabs({});

            expect(result.success).toBe(true);
            expect(result.addedCount).toBe(0);
        });
    });

    describe('getExportData', () => {
        test('returns validated V2 data', async () => {
            const popTime = MOCK_TIME + 1000;
            const item = createItem('tab-1', popTime);
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: {
                    version: 2,
                    items: { 'tab-1': item },
                    schedule: { [popTime]: ['tab-1'] }
                }
            });

            const result = await getExportData();

            expect(result.version).toBe(2);
            expect(result.items['tab-1']).toEqual(item);
            expect(result.schedule[popTime]).toEqual(['tab-1']);
        });

        test('sanitizes data before returning', async () => {
            const popTime = MOCK_TIME + 1000;
            const item = createItem('tab-1', popTime);
            chromeMock.storage.local.get.mockResolvedValue({
                snoooze_v2: {
                    version: 2,
                    items: { 'tab-1': item },
                    schedule: { [popTime]: ['tab-1', 'missing-id'] }
                }
            });

            const result = await getExportData();

            // Should return sanitized data (missing-id removed)
            expect(result.schedule[popTime]).toEqual(['tab-1']);
        });
    });
});
