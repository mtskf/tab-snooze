import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChromeApi, { storage, tabs, windows, notifications, alarms, runtime, commands } from './ChromeApi';

describe('ChromeApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn(),
          remove: vi.fn(),
          getBytesInUse: vi.fn(),
        },
        session: {
          get: vi.fn(),
          set: vi.fn(),
          remove: vi.fn(),
        },
      },
      tabs: {
        query: vi.fn(),
        create: vi.fn(),
        remove: vi.fn(),
        update: vi.fn(),
      },
      windows: {
        create: vi.fn(),
        get: vi.fn(),
        getLastFocused: vi.fn(),
        remove: vi.fn(),
      },
      notifications: {
        create: vi.fn(),
        clear: vi.fn(),
      },
      alarms: {
        create: vi.fn(),
        clear: vi.fn(),
        get: vi.fn(),
      },
      runtime: {
        sendMessage: vi.fn(),
        getURL: vi.fn(),
        openOptionsPage: vi.fn(),
        lastError: null,
      },
      commands: {
        getAll: vi.fn(),
      },
    } as unknown as typeof chrome;
  });

  describe('storage.getLocal', () => {
    it('calls chrome.storage.local.get and returns data', async () => {
      const mockData = { key: 'value' };
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const result = await storage.getLocal('key');

      expect(chrome.storage.local.get).toHaveBeenCalledWith('key');
      expect(result).toEqual(mockData);
    });

    it('throws error on failure', async () => {
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Storage error'));

      await expect(storage.getLocal('key')).rejects.toThrow('Failed to read from storage');
    });
  });

  describe('storage.setLocal', () => {
    it('calls chrome.storage.local.set', async () => {
      (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await storage.setLocal({ key: 'value' });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ key: 'value' });
    });

    it('throws error on failure', async () => {
      (chrome.storage.local.set as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Write error'));

      await expect(storage.setLocal({ key: 'value' })).rejects.toThrow('Failed to write to storage');
    });
  });

  describe('storage.removeLocal', () => {
    it('calls chrome.storage.local.remove', async () => {
      (chrome.storage.local.remove as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await storage.removeLocal('key');

      expect(chrome.storage.local.remove).toHaveBeenCalledWith('key');
    });

    it('throws error on failure', async () => {
      (chrome.storage.local.remove as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Remove error'));

      await expect(storage.removeLocal('key')).rejects.toThrow('Failed to remove from storage');
    });
  });

  describe('storage.getBytesInUse', () => {
    it('calls chrome.storage.local.getBytesInUse', async () => {
      (chrome.storage.local.getBytesInUse as ReturnType<typeof vi.fn>).mockResolvedValue(1024);

      const result = await storage.getBytesInUse(null);

      expect(chrome.storage.local.getBytesInUse).toHaveBeenCalledWith(null);
      expect(result).toBe(1024);
    });

    it('returns 0 if getBytesInUse is not supported', async () => {
      (chrome.storage.local as { getBytesInUse?: unknown }).getBytesInUse = undefined;

      const result = await storage.getBytesInUse(null);

      expect(result).toBe(0);
    });

    it('returns 0 on error', async () => {
      (chrome.storage.local.getBytesInUse as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

      const result = await storage.getBytesInUse(null);

      expect(result).toBe(0);
    });
  });

  describe('storage.getSession', () => {
    it('calls chrome.storage.session.get', async () => {
      const mockData = { sessionKey: 'sessionValue' };
      (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

      const result = await storage.getSession('sessionKey');

      expect(chrome.storage.session.get).toHaveBeenCalledWith('sessionKey');
      expect(result).toEqual(mockData);
    });

    it('returns empty object if session storage is not supported', async () => {
      (chrome.storage as { session?: unknown }).session = undefined;

      const result = await storage.getSession('key');

      expect(result).toEqual({});
    });

    it('returns empty object on error', async () => {
      (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Session error'));

      const result = await storage.getSession('key');

      expect(result).toEqual({});
    });
  });

  describe('tabs.query', () => {
    it('calls chrome.tabs.query', async () => {
      const mockTabs = [{ id: 1, url: 'https://example.com' }];
      (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue(mockTabs);

      const result = await tabs.query({ active: true });

      expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true });
      expect(result).toEqual(mockTabs);
    });

    it('throws error on failure', async () => {
      (chrome.tabs.query as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Query error'));

      await expect(tabs.query({})).rejects.toThrow('Failed to query tabs');
    });
  });

  describe('tabs.create', () => {
    it('calls chrome.tabs.create', async () => {
      const mockTab = { id: 1, url: 'https://example.com' };
      (chrome.tabs.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockTab);

      const result = await tabs.create({ url: 'https://example.com' });

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'https://example.com' });
      expect(result).toEqual(mockTab);
    });

    it('throws error on failure', async () => {
      (chrome.tabs.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Create error'));

      await expect(tabs.create({ url: 'invalid' })).rejects.toThrow('Failed to create tab');
    });
  });

  describe('tabs.remove', () => {
    it('calls chrome.tabs.remove', async () => {
      (chrome.tabs.remove as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await tabs.remove(123);

      expect(chrome.tabs.remove).toHaveBeenCalledWith(123);
    });

    it('throws error on failure', async () => {
      (chrome.tabs.remove as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Remove error'));

      await expect(tabs.remove(123)).rejects.toThrow('Failed to remove tabs');
    });
  });

  describe('windows.create', () => {
    it('calls chrome.windows.create', async () => {
      const mockWindow = { id: 1 };
      (chrome.windows.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockWindow);

      const result = await windows.create({ url: 'https://example.com' });

      expect(chrome.windows.create).toHaveBeenCalledWith({ url: 'https://example.com' });
      expect(result).toEqual(mockWindow);
    });

    it('throws error on failure', async () => {
      (chrome.windows.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Create error'));

      await expect(windows.create({})).rejects.toThrow('Failed to create window');
    });
  });

  describe('windows.getLastFocused', () => {
    it('calls chrome.windows.getLastFocused and returns window', async () => {
      const mockWindow = { id: 1, focused: true };
      (chrome.windows.getLastFocused as ReturnType<typeof vi.fn>).mockResolvedValue(mockWindow);

      const result = await windows.getLastFocused({ populate: true });

      expect(chrome.windows.getLastFocused).toHaveBeenCalledWith({ populate: true });
      expect(result).toEqual(mockWindow);
    });

    it('throws error on failure', async () => {
      (chrome.windows.getLastFocused as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Window error'));

      await expect(windows.getLastFocused()).rejects.toThrow('Failed to get last focused window');
    });
  });

  describe('windows.remove', () => {
    it('calls chrome.windows.remove with windowId', async () => {
      (chrome.windows.remove as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await windows.remove(123);

      expect(chrome.windows.remove).toHaveBeenCalledWith(123);
    });

    it('throws error on failure', async () => {
      (chrome.windows.remove as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Remove error'));

      await expect(windows.remove(123)).rejects.toThrow('Failed to remove window');
    });
  });

  describe('notifications.create', () => {
    it('calls chrome.notifications.create', async () => {
      (chrome.notifications.create as ReturnType<typeof vi.fn>).mockResolvedValue('notification-id');

      const result = await notifications.create('test-notification', {
        type: 'basic',
        title: 'Test',
        message: 'Message',
        iconUrl: 'icon.png',
      });

      expect(chrome.notifications.create).toHaveBeenCalledWith('test-notification', {
        type: 'basic',
        title: 'Test',
        message: 'Message',
        iconUrl: 'icon.png',
      });
      expect(result).toBe('notification-id');
    });

    it('throws error on failure', async () => {
      (chrome.notifications.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Notification error'));

      await expect(notifications.create('id', { type: 'basic', title: '', message: '', iconUrl: '' })).rejects.toThrow('Failed to create notification');
    });
  });

  describe('notifications.clear', () => {
    it('calls chrome.notifications.clear', async () => {
      (chrome.notifications.clear as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const result = await notifications.clear('notification-id');

      expect(chrome.notifications.clear).toHaveBeenCalledWith('notification-id');
      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      (chrome.notifications.clear as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Clear error'));

      const result = await notifications.clear('id');

      expect(result).toBe(false);
    });
  });

  describe('alarms.create', () => {
    it('calls chrome.alarms.create', async () => {
      (chrome.alarms.create as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await alarms.create('alarm-name', { periodInMinutes: 1 });

      expect(chrome.alarms.create).toHaveBeenCalledWith('alarm-name', { periodInMinutes: 1 });
    });

    it('throws error on failure', async () => {
      (chrome.alarms.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Alarm error'));

      await expect(alarms.create('name', {})).rejects.toThrow('Failed to create alarm');
    });
  });

  describe('runtime.sendMessage', () => {
    it('calls chrome.runtime.sendMessage and resolves', async () => {
      const mockResponse = { success: true };
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation((msg: unknown, callback: (response: unknown) => void) => {
        callback(mockResponse);
      });

      const result = await runtime.sendMessage({ action: 'test' });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'test' },
        expect.any(Function)
      );
      expect(result).toEqual(mockResponse);
    });

    it('rejects on chrome.runtime.lastError', async () => {
      (chrome.runtime as { lastError: { message: string } | null }).lastError = { message: 'Connection error' };
      (chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation((msg: unknown, callback: (response: unknown) => void) => {
        callback(null);
      });

      await expect(runtime.sendMessage({ action: 'test' })).rejects.toThrow('Connection error');

      (chrome.runtime as { lastError: { message: string } | null }).lastError = null;
    });
  });

  describe('runtime.getURL', () => {
    it('calls chrome.runtime.getURL', () => {
      (chrome.runtime.getURL as ReturnType<typeof vi.fn>).mockReturnValue('chrome-extension://abc123/path');

      const result = runtime.getURL('path');

      expect(chrome.runtime.getURL).toHaveBeenCalledWith('path');
      expect(result).toBe('chrome-extension://abc123/path');
    });

    it('returns empty string on error', () => {
      (chrome.runtime.getURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('API error');
      });

      const result = runtime.getURL('path');

      expect(result).toBe('');
    });
  });

  describe('runtime.openOptionsPage', () => {
    it('promisifies chrome.runtime.openOptionsPage', async () => {
      (chrome.runtime.openOptionsPage as ReturnType<typeof vi.fn>).mockImplementation((callback: () => void) => {
        callback();
      });

      await runtime.openOptionsPage();

      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });

    it('rejects on chrome.runtime.lastError', async () => {
      (chrome.runtime as { lastError: { message: string } | null }).lastError = { message: 'Options page error' };
      (chrome.runtime.openOptionsPage as ReturnType<typeof vi.fn>).mockImplementation((callback: () => void) => {
        callback();
      });

      await expect(runtime.openOptionsPage()).rejects.toThrow('Options page error');

      (chrome.runtime as { lastError: { message: string } | null }).lastError = null;
    });
  });

  describe('commands', () => {
    describe('getAll', () => {
      it('promisifies chrome.commands.getAll and returns commands', async () => {
        const mockCommands = [{ name: '_execute_action', shortcut: 'Alt+Shift+S' }];
        (chrome.commands.getAll as ReturnType<typeof vi.fn>).mockImplementation((callback: (commands: unknown[]) => void) => {
          callback(mockCommands);
        });

        const result = await commands.getAll();

        expect(chrome.commands.getAll).toHaveBeenCalled();
        expect(result).toEqual(mockCommands);
      });

      it('rejects on chrome.runtime.lastError', async () => {
        (chrome.runtime as { lastError: { message: string } | null }).lastError = { message: 'Commands error' };
        (chrome.commands.getAll as ReturnType<typeof vi.fn>).mockImplementation((callback: (commands: unknown[]) => void) => {
          callback([]);
        });

        await expect(commands.getAll()).rejects.toThrow('Commands error');

        (chrome.runtime as { lastError: { message: string } | null }).lastError = null;
      });
    });
  });

  describe('ChromeApi default export', () => {
    it('exports all API modules', () => {
      expect(ChromeApi.storage).toBe(storage);
      expect(ChromeApi.tabs).toBe(tabs);
      expect(ChromeApi.windows).toBe(windows);
      expect(ChromeApi.notifications).toBe(notifications);
      expect(ChromeApi.alarms).toBe(alarms);
      expect(ChromeApi.runtime).toBe(runtime);
      expect(ChromeApi.commands).toBe(commands);
    });
  });
});
