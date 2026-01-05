import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// getSettings mock is no longer needed as we mock sendMessage
// vi.mock('@/utils/timeUtils', () => ({
//   getSettings: vi.fn().mockResolvedValue({
//     'start-day': '8:00 AM',
//     timezone: 'UTC',
//   }),
// }));

vi.mock('@/utils/StorageService', () => ({
  StorageService: {
    parseImportFile: vi.fn(),
    exportTabs: vi.fn(),
  },
}));

vi.mock('./TimeSettings', () => ({
  default: ({ updateSetting = () => {} }) => (
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
  const snoozedDataV2 = {
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

  let onChangedListener;
  let currentSnoozedData;
  let lastSetTabs;

  beforeEach(() => {
    vi.clearAllMocks();
    currentSnoozedData = snoozedDataV2;
    onChangedListener = undefined;
    lastSetTabs = undefined;
    global.alert = vi.fn();

    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      const res = {};
      if (Array.isArray(keys)) {
        if (keys.includes('sizeWarningActive')) res.sizeWarningActive = false;
      } else if (keys === 'sizeWarningActive') {
        res.sizeWarningActive = false;
      }
      if (callback) callback(res);
      return Promise.resolve(res);
    });

    global.chrome.storage.onChanged = {
      addListener: vi.fn((listener) => {
        onChangedListener = listener;
      }),
      removeListener: vi.fn(),
    };

    global.chrome.commands = {
      getAll: vi.fn((callback) => callback([])),
    };

    global.chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'getSnoozedTabsV2') {
        if (callback) callback(currentSnoozedData);
        return;
      }
      if (message.action === 'setSnoozedTabs') {
        lastSetTabs = message.data;
        if (callback) callback();
        return;
      }
      if (message.action === 'getSettings') {
        if (callback) callback({
          'start-day': '8:00 AM',
          timezone: 'UTC'
        });
        return;
      }
      if (callback) callback();
    });
  });

  it('requests snoozed tabs via runtime message and renders them', async () => {
    render(<Options />);

    await waitFor(() => {
      expect(screen.getByText('Example Tab')).toBeInTheDocument();
    });

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
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
    };

    act(() => {
      onChangedListener(
        { snoooze_v2: { newValue: { items: {}, schedule: {} } } },
        'local'
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Next Tab')).toBeInTheDocument();
    });
  });

  it('imports V2 data with overwrite after confirmation', async () => {
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

    StorageService.parseImportFile.mockResolvedValue(importedDataV2);
    global.confirm = vi.fn().mockReturnValue(true);

    const { container } = render(<Options />);
    const fileInput = container.querySelector('input[type="file"]');

    const file = new File(['{}'], 'import.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // Should show confirmation dialog
    expect(global.confirm).toHaveBeenCalled();

    await waitFor(() => {
      // Should overwrite with imported data (not merge)
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'setSnoozedTabs', data: importedDataV2 }),
        expect.any(Function)
      );
      expect(lastSetTabs).toEqual(importedDataV2);
    });
  });

  it('cancels import and clears file input when confirmation is declined', async () => {
    const importedDataV2 = {
      version: 2,
      items: { 'imported-1': { id: 'imported-1', url: 'https://example.com', title: 'Test', popTime: 123 } },
      schedule: {},
    };

    StorageService.parseImportFile.mockResolvedValue(importedDataV2);
    global.confirm = vi.fn().mockReturnValue(false);

    const { container } = render(<Options />);
    const fileInput = container.querySelector('input[type="file"]');

    const file = new File(['{}'], 'import.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // Should show confirmation dialog
    expect(global.confirm).toHaveBeenCalled();

    // Should NOT call setSnoozedTabs
    expect(global.chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'setSnoozedTabs' }),
      expect.any(Function)
    );

    // File input should be cleared
    expect(fileInput.value).toBe('');
  });

  it('handles error response for snoozed tabs and shows empty state', async () => {
    currentSnoozedData = { error: 'failed' };
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
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.getByText('Example Tab')).toBeInTheDocument();
    });
  });

  it('shows size warning alert from storage changes', async () => {
    render(<Options />);
    expect(onChangedListener).toBeTypeOf('function');

    act(() => {
      onChangedListener(
        { sizeWarningActive: { newValue: true } },
        'local'
      );
    });

    expect(screen.getByText('Storage is almost full')).toBeInTheDocument();
  });

  it('clears all tabs only when confirmed', async () => {
    global.confirm = vi.fn().mockReturnValue(false);
    render(<Options />);

    await waitFor(() => {
      expect(screen.getByText('Delete All')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete All'));
    expect(global.chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'clearAllSnoozedTabs' }),
      expect.any(Function)
    );

    global.confirm.mockReturnValue(true);
    fireEvent.click(screen.getByText('Delete All'));
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'clearAllSnoozedTabs' }),
      expect.any(Function)
    );
  });

  it('alerts on export failure', async () => {
    StorageService.exportTabs.mockImplementation(() => {
      throw new Error('Export failed');
    });
    render(<Options />);

    fireEvent.click(screen.getByText('Export'));
    expect(global.alert).toHaveBeenCalledWith('Export failed');
  });

  it('shows validation error when import data is unrecoverable', async () => {
    StorageService.parseImportFile.mockRejectedValue(
      new Error('Invalid data structure that cannot be repaired')
    );
    const { container } = render(<Options />);
    const fileInput = container.querySelector('input[type="file"]');

    const file = new File(['{}'], 'import.json', { type: 'application/json' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(global.alert).toHaveBeenCalledWith(
      'Failed to import: The file contains invalid data.'
    );
  });

  it('should use setSettings message API instead of direct chrome.storage.local.set', async () => {
    const localSetSpy = vi.spyOn(global.chrome.storage.local, 'set');
    const sendMessageSpy = vi.spyOn(global.chrome.runtime, 'sendMessage');

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
      global.chrome.storage.session = {
        get: vi.fn(),
        remove: vi.fn().mockResolvedValue(undefined),
      };
      // Mock history.replaceState
      global.history.replaceState = vi.fn();
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
      global.chrome.storage.session.get.mockResolvedValue({
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
      global.chrome.storage.session.get.mockResolvedValue({
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
      global.chrome.storage.session.get.mockResolvedValue({
        failedRestoreTabs: mockFailedTabs,
      });

      render(<Options />);

      await waitFor(() => {
        expect(screen.getByText('Failed to Restore Tabs')).toBeInTheDocument();
      });

      // Verify session storage was cleared
      expect(global.chrome.storage.session.remove).toHaveBeenCalledWith('failedRestoreTabs');

      // Verify URL was updated to remove query param
      expect(global.history.replaceState).toHaveBeenCalledWith(
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
      expect(global.chrome.storage.session.get).not.toHaveBeenCalled();

      // Dialog should NOT be shown
      expect(screen.queryByText('Failed to Restore Tabs')).not.toBeInTheDocument();
    });
  });
});
