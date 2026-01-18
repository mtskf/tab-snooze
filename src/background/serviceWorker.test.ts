import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock snoozeLogic module
vi.mock('./snoozeLogic', () => ({
  initStorage: vi.fn().mockResolvedValue(undefined),
  popCheck: vi.fn().mockResolvedValue(undefined),
  snooze: vi.fn(),
  removeSnoozedTabWrapper: vi.fn(),
  removeWindowGroup: vi.fn(),
  restoreWindowGroup: vi.fn(),
  getSnoozedTabsV2: vi.fn(),
  setSnoozedTabs: vi.fn(),
  getSettings: vi.fn(),
  setSettings: vi.fn(),
  importTabs: vi.fn(),
  getExportData: vi.fn(),
}));

describe('serviceWorker notification click handler', () => {
  let notificationClickHandler: ((notificationId: string) => void) | null;
  let tabsCreateMock: ReturnType<typeof vi.fn>;
  let runtimeGetURLMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Capture the notification click handler when registered
    notificationClickHandler = null;
    tabsCreateMock = vi.fn().mockResolvedValue({});
    runtimeGetURLMock = vi.fn((path: string) => `chrome-extension://fake-id/${path}`);

    // Setup chrome API mocks
    globalThis.chrome = {
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn() },
        getURL: runtimeGetURLMock,
      },
      alarms: {
        onAlarm: { addListener: vi.fn() },
        create: vi.fn(),
      },
      notifications: {
        onClicked: {
          addListener: vi.fn((handler: (notificationId: string) => void) => {
            notificationClickHandler = handler;
          }),
        },
        create: vi.fn(),
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
        session: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
      },
      tabs: {
        create: tabsCreateMock,
      },
    } as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function importServiceWorker() {
    // Dynamic import to ensure mocks are set up first
    await import('./serviceWorker');
  }

  it('opens Options page when storage-warning notification is clicked', async () => {
    await importServiceWorker();

    expect(notificationClickHandler).not.toBeNull();

    // Trigger click on storage-warning notification
    notificationClickHandler!('storage-warning');

    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'chrome-extension://fake-id/options/index.html',
    });
  });

  it('opens Options page when recovery-notification is clicked', async () => {
    await importServiceWorker();

    expect(notificationClickHandler).not.toBeNull();

    // Trigger click on recovery-notification
    notificationClickHandler!('recovery-notification');

    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'chrome-extension://fake-id/options/index.html',
    });
  });

  it('opens Options with showFailedTabs param when restore-failed notification is clicked', async () => {
    await importServiceWorker();

    expect(notificationClickHandler).not.toBeNull();

    // Trigger click on restore-failed notification
    notificationClickHandler!('restore-failed');

    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'chrome-extension://fake-id/options/index.html?showFailedTabs=true',
    });
  });

  it('does nothing for unknown notification IDs', async () => {
    await importServiceWorker();

    expect(notificationClickHandler).not.toBeNull();

    // Trigger click on unknown notification
    notificationClickHandler!('unknown-notification');

    expect(tabsCreateMock).not.toHaveBeenCalled();
  });
});

describe('serviceWorker onInstalled event', () => {
  let installedHandler: (() => void) | null;
  let alarmsCreateMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();

    installedHandler = null;
    alarmsCreateMock = vi.fn().mockResolvedValue(undefined);

    // Setup chrome API mocks
    globalThis.chrome = {
      runtime: {
        onInstalled: {
          addListener: vi.fn((handler: () => void) => {
            installedHandler = handler;
          }),
        },
        onStartup: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn() },
        getURL: vi.fn((path: string) => `chrome-extension://fake-id/${path}`),
      },
      alarms: {
        onAlarm: { addListener: vi.fn() },
        create: alarmsCreateMock,
      },
      notifications: {
        onClicked: { addListener: vi.fn() },
        create: vi.fn().mockResolvedValue(undefined),
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          getBytesInUse: vi.fn().mockResolvedValue(0),
        },
        session: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
      },
      tabs: {
        create: vi.fn(),
      },
    } as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  async function importServiceWorker() {
    await import('./serviceWorker');
  }

  it('calls initStorage on install', async () => {
    const { initStorage } = await import('./snoozeLogic');

    await importServiceWorker();

    expect(installedHandler).not.toBeNull();

    // Trigger onInstalled event
    await installedHandler!();

    expect(initStorage).toHaveBeenCalledOnce();
  });

  it('creates popCheck alarm with 1 minute interval', async () => {
    await importServiceWorker();

    expect(installedHandler).not.toBeNull();

    // Trigger onInstalled event
    await installedHandler!();

    expect(alarmsCreateMock).toHaveBeenCalledWith('popCheck', { periodInMinutes: 1 });
  });

  it('calls popCheck after 1 second delay', async () => {
    const { popCheck } = await import('./snoozeLogic');

    await importServiceWorker();

    expect(installedHandler).not.toBeNull();

    // Trigger onInstalled event
    const installPromise = installedHandler!();

    // Fast-forward 1 second
    vi.advanceTimersByTime(1000);

    await installPromise;
    await vi.runAllTimersAsync();

    expect(popCheck).toHaveBeenCalledOnce();
  });

  // Helper function to reduce test duplication
  async function setupRecoveryNotificationTest(sessionData: {
    pendingRecoveryNotification: number;
    lastRecoveryNotifiedAt?: number;
  }) {
    const sessionGetMock = vi.fn().mockResolvedValue(sessionData);
    const sessionSetMock = vi.fn().mockResolvedValue(undefined);
    const sessionRemoveMock = vi.fn().mockResolvedValue(undefined);
    const notificationsCreateMock = vi.fn().mockResolvedValue(undefined);

    (globalThis.chrome.storage.session.get as ReturnType<typeof vi.fn>) = sessionGetMock;
    (globalThis.chrome.storage.session.set as ReturnType<typeof vi.fn>) = sessionSetMock;
    (globalThis.chrome.storage.session.remove as ReturnType<typeof vi.fn>) = sessionRemoveMock;
    (globalThis.chrome.notifications.create as ReturnType<typeof vi.fn>) = notificationsCreateMock;

    await importServiceWorker();
    expect(installedHandler).not.toBeNull();
    await installedHandler!();

    return { sessionGetMock, sessionSetMock, sessionRemoveMock, notificationsCreateMock };
  }

  it('checks for pending recovery notification', async () => {
    const { sessionGetMock, sessionSetMock, sessionRemoveMock, notificationsCreateMock } =
      await setupRecoveryNotificationTest({ pendingRecoveryNotification: 5 });

    // Should check for pending recovery notification
    expect(sessionGetMock).toHaveBeenCalledWith(['pendingRecoveryNotification', 'lastRecoveryNotifiedAt']);

    // Should create notification
    expect(notificationsCreateMock).toHaveBeenCalledWith('recovery-notification', {
      type: 'basic',
      iconUrl: 'assets/icon128.png',
      title: 'Snooooze Data Recovered',
      message: 'Recovered 5 snoozed tabs from backup.',
      priority: 1
    });

    // Should update timestamp
    expect(sessionSetMock).toHaveBeenCalledWith({ lastRecoveryNotifiedAt: expect.any(Number) });

    // Should clear pending flag
    expect(sessionRemoveMock).toHaveBeenCalledWith('pendingRecoveryNotification');
  });

  it('suppresses notification when within 5-minute cooldown', async () => {
    const now = Date.now();
    const recentNotification = now - (3 * 60 * 1000); // 3 minutes ago (within 5-min cooldown)

    const { sessionGetMock, sessionSetMock, sessionRemoveMock, notificationsCreateMock } =
      await setupRecoveryNotificationTest({
        pendingRecoveryNotification: 5,
        lastRecoveryNotifiedAt: recentNotification,
      });

    // Should check for pending recovery notification
    expect(sessionGetMock).toHaveBeenCalledWith(['pendingRecoveryNotification', 'lastRecoveryNotifiedAt']);

    // Should NOT create notification (within cooldown)
    expect(notificationsCreateMock).not.toHaveBeenCalled();

    // Should NOT update timestamp (notification suppressed)
    expect(sessionSetMock).not.toHaveBeenCalled();

    // Should still clear pending flag
    expect(sessionRemoveMock).toHaveBeenCalledWith('pendingRecoveryNotification');
  });

  it('shows notification when cooldown has expired', async () => {
    const now = Date.now();
    const oldNotification = now - (6 * 60 * 1000); // 6 minutes ago (exceeds 5-min cooldown)

    const { sessionGetMock, sessionSetMock, sessionRemoveMock, notificationsCreateMock } =
      await setupRecoveryNotificationTest({
        pendingRecoveryNotification: 3,
        lastRecoveryNotifiedAt: oldNotification,
      });

    // Should check for pending recovery notification
    expect(sessionGetMock).toHaveBeenCalledWith(['pendingRecoveryNotification', 'lastRecoveryNotifiedAt']);

    // Should create notification (cooldown expired)
    expect(notificationsCreateMock).toHaveBeenCalledWith('recovery-notification', {
      type: 'basic',
      iconUrl: 'assets/icon128.png',
      title: 'Snooooze Data Recovered',
      message: 'Recovered 3 snoozed tabs from backup.',
      priority: 1
    });

    // Should update timestamp
    expect(sessionSetMock).toHaveBeenCalledWith({ lastRecoveryNotifiedAt: expect.any(Number) });

    // Should clear pending flag
    expect(sessionRemoveMock).toHaveBeenCalledWith('pendingRecoveryNotification');
  });

  it('shows notification when lastRecoveryNotifiedAt is undefined (first time)', async () => {
    const { sessionGetMock, sessionSetMock, sessionRemoveMock, notificationsCreateMock } =
      await setupRecoveryNotificationTest({
        pendingRecoveryNotification: 2,
        // lastRecoveryNotifiedAt is undefined (first time)
      });

    // Should check for pending recovery notification
    expect(sessionGetMock).toHaveBeenCalledWith(['pendingRecoveryNotification', 'lastRecoveryNotifiedAt']);

    // Should create notification (first time, no previous notification)
    expect(notificationsCreateMock).toHaveBeenCalledWith('recovery-notification', {
      type: 'basic',
      iconUrl: 'assets/icon128.png',
      title: 'Snooooze Data Recovered',
      message: 'Recovered 2 snoozed tabs from backup.',
      priority: 1
    });

    // Should update timestamp
    expect(sessionSetMock).toHaveBeenCalledWith({ lastRecoveryNotifiedAt: expect.any(Number) });

    // Should clear pending flag
    expect(sessionRemoveMock).toHaveBeenCalledWith('pendingRecoveryNotification');
  });

  it('suppresses notification at exactly 5-minute boundary', async () => {
    const now = Date.now();
    const NOTIFICATION_COOLDOWN = 5 * 60 * 1000;
    const exactBoundary = now - NOTIFICATION_COOLDOWN; // Exactly 5 minutes

    const { sessionGetMock, sessionSetMock, sessionRemoveMock, notificationsCreateMock } =
      await setupRecoveryNotificationTest({
        pendingRecoveryNotification: 4,
        lastRecoveryNotifiedAt: exactBoundary,
      });

    // Should check for pending recovery notification
    expect(sessionGetMock).toHaveBeenCalledWith(['pendingRecoveryNotification', 'lastRecoveryNotifiedAt']);

    // Should NOT create notification (boundary case: condition uses > not >=)
    expect(notificationsCreateMock).not.toHaveBeenCalled();

    // Should NOT update timestamp
    expect(sessionSetMock).not.toHaveBeenCalled();

    // Should still clear pending flag
    expect(sessionRemoveMock).toHaveBeenCalledWith('pendingRecoveryNotification');
  });

  it('shows corruption message when zero tabs recovered', async () => {
    const { sessionGetMock, sessionSetMock, sessionRemoveMock, notificationsCreateMock } =
      await setupRecoveryNotificationTest({
        pendingRecoveryNotification: 0, // Corruption case
      });

    // Should check for pending recovery notification
    expect(sessionGetMock).toHaveBeenCalledWith(['pendingRecoveryNotification', 'lastRecoveryNotifiedAt']);

    // Should create notification with corruption message
    expect(notificationsCreateMock).toHaveBeenCalledWith('recovery-notification', {
      type: 'basic',
      iconUrl: 'assets/icon128.png',
      title: 'Snooooze Data Recovered',
      message: 'Snoozed tabs data was reset due to corruption.',
      priority: 1
    });

    // Should update timestamp
    expect(sessionSetMock).toHaveBeenCalledWith({ lastRecoveryNotifiedAt: expect.any(Number) });

    // Should clear pending flag
    expect(sessionRemoveMock).toHaveBeenCalledWith('pendingRecoveryNotification');
  });

  it('uses singular "tab" when recovering one tab', async () => {
    const { sessionGetMock, sessionSetMock, sessionRemoveMock, notificationsCreateMock } =
      await setupRecoveryNotificationTest({
        pendingRecoveryNotification: 1, // Singular case
      });

    // Should check for pending recovery notification
    expect(sessionGetMock).toHaveBeenCalledWith(['pendingRecoveryNotification', 'lastRecoveryNotifiedAt']);

    // Should create notification with singular "tab" (no 's')
    expect(notificationsCreateMock).toHaveBeenCalledWith('recovery-notification', {
      type: 'basic',
      iconUrl: 'assets/icon128.png',
      title: 'Snooooze Data Recovered',
      message: 'Recovered 1 snoozed tab from backup.',
      priority: 1
    });

    // Should update timestamp
    expect(sessionSetMock).toHaveBeenCalledWith({ lastRecoveryNotifiedAt: expect.any(Number) });

    // Should clear pending flag
    expect(sessionRemoveMock).toHaveBeenCalledWith('pendingRecoveryNotification');
  });
});

describe('serviceWorker onStartup event', () => {
  let startupHandler: (() => void) | null;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();

    startupHandler = null;

    // Setup chrome API mocks
    globalThis.chrome = {
      runtime: {
        onInstalled: { addListener: vi.fn() },
        onStartup: {
          addListener: vi.fn((handler: () => void) => {
            startupHandler = handler;
          }),
        },
        onMessage: { addListener: vi.fn() },
        getURL: vi.fn((path: string) => `chrome-extension://fake-id/${path}`),
      },
      alarms: {
        onAlarm: { addListener: vi.fn() },
        create: vi.fn(),
      },
      notifications: {
        onClicked: { addListener: vi.fn() },
        create: vi.fn().mockResolvedValue(undefined),
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          getBytesInUse: vi.fn().mockResolvedValue(0),
        },
        session: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
      },
      tabs: {
        create: vi.fn(),
      },
    } as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  async function importServiceWorker() {
    await import('./serviceWorker');
  }

  it('calls initStorage on startup', async () => {
    const { initStorage } = await import('./snoozeLogic');

    await importServiceWorker();

    expect(startupHandler).not.toBeNull();

    // Trigger onStartup event
    await startupHandler!();

    expect(initStorage).toHaveBeenCalledOnce();
  });

  it('calls popCheck after 1 second delay', async () => {
    const { popCheck } = await import('./snoozeLogic');

    await importServiceWorker();

    expect(startupHandler).not.toBeNull();

    // Trigger onStartup event
    const startupPromise = startupHandler!();

    // Fast-forward 1 second
    vi.advanceTimersByTime(1000);

    await startupPromise;
    await vi.runAllTimersAsync();

    expect(popCheck).toHaveBeenCalledOnce();
  });

  it('checks for pending recovery notification', async () => {
    const sessionGetMock = vi.fn().mockResolvedValue({
      pendingRecoveryNotification: 3,
    });
    const sessionSetMock = vi.fn().mockResolvedValue(undefined);
    const sessionRemoveMock = vi.fn().mockResolvedValue(undefined);
    const notificationsCreateMock = vi.fn().mockResolvedValue(undefined);

    (globalThis.chrome.storage.session.get as ReturnType<typeof vi.fn>) = sessionGetMock;
    (globalThis.chrome.storage.session.set as ReturnType<typeof vi.fn>) = sessionSetMock;
    (globalThis.chrome.storage.session.remove as ReturnType<typeof vi.fn>) = sessionRemoveMock;
    (globalThis.chrome.notifications.create as ReturnType<typeof vi.fn>) = notificationsCreateMock;

    await importServiceWorker();

    expect(startupHandler).not.toBeNull();

    // Trigger onStartup event
    await startupHandler!();

    // Should check for pending recovery notification
    expect(sessionGetMock).toHaveBeenCalledWith(['pendingRecoveryNotification', 'lastRecoveryNotifiedAt']);

    // Should create notification
    expect(notificationsCreateMock).toHaveBeenCalledWith('recovery-notification', {
      type: 'basic',
      iconUrl: 'assets/icon128.png',
      title: 'Snooooze Data Recovered',
      message: 'Recovered 3 snoozed tabs from backup.',
      priority: 1
    });

    // Should update timestamp
    expect(sessionSetMock).toHaveBeenCalledWith({ lastRecoveryNotifiedAt: expect.any(Number) });

    // Should clear pending flag
    expect(sessionRemoveMock).toHaveBeenCalledWith('pendingRecoveryNotification');
  });
});
