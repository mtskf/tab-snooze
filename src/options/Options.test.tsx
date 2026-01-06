import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StorageV2 } from '@/types';

// Access globalThis with a type that allows mock assignments
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const testGlobals = globalThis as any;

// getSettings mock is no longer needed as we mock sendMessage
// vi.mock('@/utils/timeUtils', () => ({
//   getSettings: vi.fn().mockResolvedValue({
//     'start-day': '8:00 AM',
//     timezone: 'UTC',
//   }),
// }));

vi.mock('@/utils/StorageService', () => ({
  StorageService: {
    readJsonFile: vi.fn(),
    downloadAsJson: vi.fn(),
    // Legacy aliases (kept for backward compatibility)
    parseImportFile: vi.fn(),
    exportTabs: vi.fn(),
  },
}));

vi.mock('./TimeSettings', () => ({
  default: ({ updateSetting = () => {} }: { updateSetting?: (key: string, value: string) => void }) => (
    <button
      data-testid="test-update-setting"
      onClick={() => updateSetting('start-day', '9:00 AM')}
    >
      Test Update Setting
    </button>
  ),
}));
vi.mock('./GlobalShortcutSettings', () => ({
  default: () => null,
}));
vi.mock('./SnoozeActionSettings', () => ({
  default: () => null,
}));
vi.mock('./AppearanceSettings', () => ({
  default: () => null,
}));

import { StorageService } from '@/utils/StorageService';
import Options from './Options';

describe('Options', () => {
  // V2 format data
  const snoozedDataV2: StorageV2 = {
    version: 2,
    items: {
      'tab-1': {
        id: 'tab-1',
        url: 'https://example.com',
        title: 'Example Tab',
        favicon: '',
        creationTime: 123,
        popTime: 1704100000000,
      },
    },
    schedule: {
      '1704100000000': ['tab-1'],
    },
  };

  let onChangedListener: ((changes: Record<string, { newValue?: unknown }>, areaName: string) => void) | undefined;
  let currentSnoozedData: StorageV2 | { error: string };
  let lastSetTabs: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    currentSnoozedData = snoozedDataV2;
    onChangedListener = undefined;
    lastSetTabs = undefined;
    testGlobals.alert = vi.fn();

    testGlobals.chrome.storage.local.get.mockImplementation((keys: string | string[] | null, callback?: (items: Record<string, unknown>) => void) => {
      const res: Record<string, unknown> = {};
      if (Array.isArray(keys)) {
        if (keys.includes('sizeWarningActive')) res.sizeWarningActive = false;
      } else if (keys === 'sizeWarningActive') {
        res.sizeWarningActive = false;
      }
      if (callback) callback(res);
      return Promise.resolve(res);
    });

    testGlobals.chrome.storage.onChanged = {
      addListener: vi.fn((listener) => {
        onChangedListener = listener;
      }),
      removeListener: vi.fn(),
    };

    testGlobals.chrome.commands = {
      getAll: vi.fn((callback) => callback([])),
    };

    testGlobals.chrome.runtime.sendMessage.mockImplementation((message: { action: string; data?: unknown }, callback?: (response: unknown) => void) => {
      if (message.action === 'getSnoozedTabsV2') {
        if (callback) callback(currentSnoozedData);
        return;
      }
      if (message.action === 'setSnoozedTabs') {
        lastSetTabs = message.data;
        if (callback) callback(undefined);
        return;
      }
      if (message.action === 'getSettings') {
        if (callback) callback({
          'start-day': '8:00 AM',
          timezone: 'UTC'
        });
        return;
      }
      if (callback) callback(undefined);
    });
  });

  it('requests snoozed tabs via runtime message and renders them', async () => {
    render(<Options />);

    await waitFor(() => {
      expect(screen.getByText('Example Tab')).toBeInTheDocument();
    });

    expect(testGlobals.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'getSnoozedTabsV2' }),
      expect.any(Function)
    );
  });

  it('refreshes snoozed tabs when snoooze_v2 changes', async () => {
    render(<Options />);

    await waitFor(() => {
      expect(screen.getByText('Example Tab')).toBeInTheDocument();
    });
    expect(onChangedListener).toBeTypeOf('function');

    currentSnoozedData = {
      version: 2,
      items: {
        'tab-2': {
          id: 'tab-2',
          url: 'https://example.com/next',
          title: 'Next Tab',
          favicon: '',
          creationTime: 124,
          popTime: 1704200000000,
        },
      },
      schedule: {
        '1704200000000': ['tab-2'],
      },
    } as StorageV2;

    act(() => {
      onChangedListener?.(
        { snoooze_v2: { newValue: { items: {}, schedule: {} } } },
        'local'
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Next Tab')).toBeInTheDocument();
    });
  });

  it('imports data via background importTabs after confirmation', async () => {
    const importedDataV2 = {
      version: 2,
      items: {
        'imported-1': {
          id: 'imported-1',
          url: 'https://example.com/imported',
          title: 'Imported Tab',
          favicon: '',
          creationTime: 125,
          popTime: 1704300000000,
        },
      },
      schedule: {
        '1704300000000': ['imported-1'],
      },
    };

    vi.mocked(StorageService.readJsonFile).mockResolvedValue(importedDataV2);
    testGlobals.confirm = vi.fn().mockReturnValue(true);

    // Mock importTabs response
    testGlobals.chrome.runtime.sendMessage.mockImplementation((message: { action: string; data?: unknown }, callback?: (response: unknown) => void) => {
      if (message.action === 'getSnoozedTabsV2') {
        if (callback) callback(currentSnoozedData);
        return;
      }
      if (message.action === 'importTabs') {
        if (callback) callback({ success: true, addedCount: 1 });
        return;
      }
      if (message.action === 'getSettings') {
        if (callback) callback({ 'start-day': '8:00 AM', timezone: 'UTC' });
        return;
      }
      if (callback) callback(undefined);
    });

    const { container } = render(<Options />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['{}'], 'import.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // Should show confirmation dialog
    expect(testGlobals.confirm).toHaveBeenCalled();

    await waitFor(() => {
      // Should call importTabs message (not setSnoozedTabs)
      expect(testGlobals.chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'importTabs', data: importedDataV2 }),
        expect.any(Function)
      );
    });

    // Should show success alert
    expect(testGlobals.alert).toHaveBeenCalledWith('Imported 1 tabs successfully!');
  });

  it('cancels import and clears file input when confirmation is declined', async () => {
    const importedDataV2 = {
      version: 2,
      items: { 'imported-1': { id: 'imported-1', url: 'https://example.com', title: 'Test', popTime: 123 } },
      schedule: {},
    };

    vi.mocked(StorageService.readJsonFile).mockResolvedValue(importedDataV2);
    testGlobals.confirm = vi.fn().mockReturnValue(false);

    const { container } = render(<Options />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['{}'], 'import.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // Should show confirmation dialog
    expect(testGlobals.confirm).toHaveBeenCalled();

    // Should NOT call importTabs
    expect(testGlobals.chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'importTabs' }),
      expect.any(Function)
    );

    // File input should be cleared
    expect(fileInput.value).toBe('');
  });

  it('handles error response for snoozed tabs and shows empty state', async () => {
    currentSnoozedData = { error: 'failed' } as unknown as typeof snoozedDataV2;
    render(<Options />);

    await waitFor(() => {
      expect(screen.getByText('No snoozed tabs.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Delete All')).not.toBeInTheDocument();
  });

  it('filters snoozed tabs by search and clears the query', async () => {
    const { container } = render(<Options />);

    await waitFor(() => {
      expect(screen.getByText('Example Tab')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search tabs...');
    fireEvent.change(searchInput, { target: { value: 'nomatch' } });
    expect(screen.getByText('No snoozed tabs.')).toBeInTheDocument();

    const clearButton = container.querySelector('button.absolute');
    expect(clearButton).toBeTruthy();
    fireEvent.click(clearButton!);

    await waitFor(() => {
      expect(screen.getByText('Example Tab')).toBeInTheDocument();
    });
  });

  it('shows size warning alert from storage changes', async () => {
    render(<Options />);
    expect(onChangedListener).toBeTypeOf('function');

    act(() => {
      onChangedListener?.(
        { sizeWarningActive: { newValue: true } },
        'local'
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Storage is almost full')).toBeInTheDocument();
    });
  });

  it('clears all tabs only when confirmed', async () => {
    testGlobals.confirm = vi.fn().mockReturnValue(false);
    render(<Options />);

    await waitFor(() => {
      expect(screen.getByText('Delete All')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete All'));
    expect(testGlobals.chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'clearAllSnoozedTabs' }),
      expect.any(Function)
    );

    testGlobals.confirm.mockReturnValue(true);
    fireEvent.click(screen.getByText('Delete All'));
    expect(testGlobals.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'clearAllSnoozedTabs' }),
      expect.any(Function)
    );
  });

  it('alerts on export failure', async () => {
    // Mock exportTabs message to return data, but downloadAsJson to throw
    testGlobals.chrome.runtime.sendMessage.mockImplementation((message: { action: string; data?: unknown }, callback?: (response: unknown) => void) => {
      if (message.action === 'getSnoozedTabsV2') {
        if (callback) callback(currentSnoozedData);
        return;
      }
      if (message.action === 'exportTabs') {
        if (callback) callback(snoozedDataV2);
        return;
      }
      if (message.action === 'getSettings') {
        if (callback) callback({ 'start-day': '8:00 AM', timezone: 'UTC' });
        return;
      }
      if (callback) callback(undefined);
    });

    vi.mocked(StorageService.downloadAsJson).mockImplementation(() => {
      throw new Error('Export failed');
    });

    render(<Options />);

    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Export'));
    });

    await waitFor(() => {
      expect(testGlobals.alert).toHaveBeenCalledWith('Export failed');
    });
  });

  it('shows error when readJsonFile fails to parse', async () => {
    vi.mocked(StorageService.readJsonFile).mockRejectedValue(
      new Error('Invalid JSON file')
    );
    const { container } = render(<Options />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['{}'], 'import.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(testGlobals.alert).toHaveBeenCalledWith(
      'Failed to import: Invalid JSON file'
    );
  });

  it('shows error when background importTabs fails', async () => {
    const importData = {
      version: 2,
      items: { 'tab-1': { id: 'tab-1', url: 'https://example.com', title: 'Test', popTime: 123 } },
      schedule: {},
    };
    vi.mocked(StorageService.readJsonFile).mockResolvedValue(importData);
    testGlobals.confirm = vi.fn().mockReturnValue(true);

    // Mock importTabs to return failure (without top-level 'error' to avoid sendMessage rejection)
    testGlobals.chrome.runtime.sendMessage.mockImplementation((message: { action: string; data?: unknown }, callback?: (response: unknown) => void) => {
      if (message.action === 'getSnoozedTabsV2') {
        if (callback) callback(currentSnoozedData);
        return;
      }
      if (message.action === 'importTabs') {
        // Return failure result - sendMessage will resolve with this (not reject)
        // because the error is in result.error not response.error at top level
        if (callback) callback({ success: false, error: 'Invalid data structure' });
        return;
      }
      if (message.action === 'getSettings') {
        if (callback) callback({ 'start-day': '8:00 AM', timezone: 'UTC' });
        return;
      }
      if (callback) callback(undefined);
    });

    const { container } = render(<Options />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['{}'], 'import.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // sendMessage sees response.error and rejects, so catch block handles it
    await waitFor(() => {
      expect(testGlobals.alert).toHaveBeenCalledWith(
        'Failed to import: Invalid data structure'
      );
    });
  });

  it('should use setSettings message API instead of direct chrome.storage.local.set', async () => {
    const localSetSpy = vi.spyOn(testGlobals.chrome.storage.local, 'set');
    const sendMessageSpy = vi.spyOn(testGlobals.chrome.runtime, 'sendMessage');

    // Set hash to open Settings tab by default
    window.location.hash = '#settings';

    render(<Options />);

    // Wait for test button to appear (Settings tab is active by default)
    await waitFor(() => {
      expect(screen.getByTestId('test-update-setting')).toBeInTheDocument();
    });

    // Clear previous sendMessage calls from initial load
    sendMessageSpy.mockClear();
    localSetSpy.mockClear();

    // Trigger updateSetting by clicking the test button
    fireEvent.click(screen.getByTestId('test-update-setting'));

    // Should call setSettings message
    expect(sendMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'setSettings',
        data: expect.objectContaining({ 'start-day': '9:00 AM' })
      }),
      expect.any(Function)
    );

    // Should NOT call chrome.storage.local.set directly
    expect(localSetSpy).not.toHaveBeenCalled();

    // Clean up
    window.location.hash = '';
  });

  describe('FailedTabsDialog integration', () => {
    const mockFailedTabs = [
      { id: 'tab-1', url: 'https://example.com/page1', title: 'Failed Page 1' },
      { id: 'tab-2', url: 'https://test.com/page2', title: 'Failed Page 2' },
    ];

    beforeEach(() => {
      // Setup session storage mock
      testGlobals.chrome.storage.session = {
        get: vi.fn(),
        remove: vi.fn().mockResolvedValue(undefined),
      };
      // Mock history.replaceState
      testGlobals.history.replaceState = vi.fn();
    });

    afterEach(() => {
      // Reset URL search params
      Object.defineProperty(window, 'location', {
        value: { search: '', pathname: '/options/index.html', hash: '' },
        writable: true,
      });
    });

    it('opens FailedTabsDialog when URL has showFailedTabs=true and session has failed tabs', async () => {
      // Set URL query param
      Object.defineProperty(window, 'location', {
        value: { search: '?showFailedTabs=true', pathname: '/options/index.html', hash: '' },
        writable: true,
      });

      // Mock session storage to return failed tabs
      vi.mocked(testGlobals.chrome.storage.session.get).mockResolvedValue({
        failedRestoreTabs: mockFailedTabs,
      });

      render(<Options />);

      // Wait for dialog to open
      await waitFor(() => {
        expect(screen.getByText('Failed to Restore Tabs')).toBeInTheDocument();
      });

      // Verify failed tabs are displayed
      expect(screen.getByText('Failed Page 1')).toBeInTheDocument();
      expect(screen.getByText('Failed Page 2')).toBeInTheDocument();
    });

    it('does NOT open FailedTabsDialog when session storage is empty', async () => {
      // Set URL query param
      Object.defineProperty(window, 'location', {
        value: { search: '?showFailedTabs=true', pathname: '/options/index.html', hash: '' },
        writable: true,
      });

      // Mock session storage to return empty
      vi.mocked(testGlobals.chrome.storage.session.get).mockResolvedValue({
        failedRestoreTabs: [],
      });

      render(<Options />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Snoozed Items')).toBeInTheDocument();
      });

      // Dialog should NOT be shown
      expect(screen.queryByText('Failed to Restore Tabs')).not.toBeInTheDocument();
    });

    it('clears session storage and URL param after opening dialog', async () => {
      // Set URL query param
      Object.defineProperty(window, 'location', {
        value: { search: '?showFailedTabs=true', pathname: '/options/index.html', hash: '' },
        writable: true,
      });

      // Mock session storage
      vi.mocked(testGlobals.chrome.storage.session.get).mockResolvedValue({
        failedRestoreTabs: mockFailedTabs,
      });

      render(<Options />);

      await waitFor(() => {
        expect(screen.getByText('Failed to Restore Tabs')).toBeInTheDocument();
      });

      // Verify session storage was cleared
      expect(testGlobals.chrome.storage.session.remove).toHaveBeenCalledWith('failedRestoreTabs');

      // Verify URL was updated to remove query param
      expect(testGlobals.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        '/options/index.html'
      );
    });

    it('does NOT open dialog when URL does not have showFailedTabs param', async () => {
      // No query param
      Object.defineProperty(window, 'location', {
        value: { search: '', pathname: '/options/index.html', hash: '' },
        writable: true,
      });

      render(<Options />);

      await waitFor(() => {
        expect(screen.getByText('Snoozed Items')).toBeInTheDocument();
      });

      // Session storage should not be checked
      expect(testGlobals.chrome.storage.session.get).not.toHaveBeenCalled();

      // Dialog should NOT be shown
      expect(screen.queryByText('Failed to Restore Tabs')).not.toBeInTheDocument();
    });
  });
});
