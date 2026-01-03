import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkStorageSize,
  getSnoozedTabs,
  setSnoozedTabs,
  initStorage,
  snooze,
  popCheck,
  removeSnoozedTabWrapper,
  removeWindowGroup,
  getSettings,
} from './snoozeLogic';

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

const createV2Data = (items = {}, schedule = {}) => ({
  snoooze_v2: { items, schedule }
});

const createItem = (id, popTime, overrides = {}) => ({
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
                snoooze_v2: { items: {}, schedule: {} }
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

    test('snooze - saves to V2 items and schedule w/ ID', async () => {
        const popTime = new Date(MOCK_TIME + 3600000);
        const tab = { url: TAB_URL, title: TAB_TITLE, index: 0, id: 99 };

        await snooze(tab, popTime);

        expect(chromeMock.storage.local.set).toHaveBeenCalled();
        const callArg = chromeMock.storage.local.set.mock.calls[0][0];
        expect(callArg.snoooze_v2).toBeDefined();

        const ids = Object.keys(callArg.snoooze_v2.items);
        expect(ids.length).toBe(1);
        expect(callArg.snoooze_v2.schedule[popTime.getTime()]).toContain(ids[0]);
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
        const verifyCall = chromeMock.storage.local.set.mock.lastCall[0];
        expect(verifyCall.snoooze_v2.items[id]).toBeUndefined();
    });

    test('removeSnoozedTabWrapper - removes from V2 by ID', async () => {
        const popTime = MOCK_TIME + 10000;
        const id = 'tab-rem';
        const item = createItem(id, popTime);

        chromeMock.storage.local.get.mockResolvedValue(createV2Data(
            { [id]: item },
            { [popTime]: [id] }
        ));

        await removeSnoozedTabWrapper({ id: id, popTime: popTime });

        expect(chromeMock.storage.local.set).toHaveBeenCalled();
        const setCall = chromeMock.storage.local.set.mock.lastCall[0];
        expect(setCall.snoooze_v2.items[id]).toBeUndefined();
    });

    test('RESTRICTED_PROTOCOLS prevent saving', async () => {
        const popTime = new Date(MOCK_TIME + 1000);
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

            vi.unstubAllGlobals(); // Cleanup Intl
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

            vi.unstubAllGlobals();
        });
    });
});
