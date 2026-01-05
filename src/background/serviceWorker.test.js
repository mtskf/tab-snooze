import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('serviceWorker notification click handler', () => {
  let notificationClickHandler;
  let tabsCreateMock;
  let runtimeGetURLMock;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Capture the notification click handler when registered
    notificationClickHandler = null;
    tabsCreateMock = vi.fn().mockResolvedValue({});
    runtimeGetURLMock = vi.fn((path) => `chrome-extension://fake-id/${path}`);

    // Setup chrome API mocks
    global.chrome = {
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
          addListener: vi.fn((handler) => {
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
    };
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function importServiceWorker() {
    // Dynamic import to ensure mocks are set up first
    await import('./serviceWorker.js');
  }

  it('opens Options page when storage-warning notification is clicked', async () => {
    await importServiceWorker();

    expect(notificationClickHandler).not.toBeNull();

    // Trigger click on storage-warning notification
    notificationClickHandler('storage-warning');

    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'chrome-extension://fake-id/options/index.html',
    });
  });

  it('opens Options page when recovery-notification is clicked', async () => {
    await importServiceWorker();

    expect(notificationClickHandler).not.toBeNull();

    // Trigger click on recovery-notification
    notificationClickHandler('recovery-notification');

    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'chrome-extension://fake-id/options/index.html',
    });
  });

  it('opens Options with showFailedTabs param when restore-failed notification is clicked', async () => {
    await importServiceWorker();

    expect(notificationClickHandler).not.toBeNull();

    // Trigger click on restore-failed notification
    notificationClickHandler('restore-failed');

    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'chrome-extension://fake-id/options/index.html?showFailedTabs=true',
    });
  });

  it('does nothing for unknown notification IDs', async () => {
    await importServiceWorker();

    expect(notificationClickHandler).not.toBeNull();

    // Trigger click on unknown notification
    notificationClickHandler('unknown-notification');

    expect(tabsCreateMock).not.toHaveBeenCalled();
  });
});
