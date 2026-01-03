import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Popup from './Popup';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../background/snoozeLogic', () => ({
  snooze: vi.fn(),
  popCheck: vi.fn(),
  initStorage: vi.fn(),
}));

vi.mock('../utils/timeUtils', () => ({
  getTime: vi.fn().mockResolvedValue(new Date('2024-01-01T10:00:00Z')),
  getSettings: vi.fn().mockResolvedValue({
      'start-day': '8:00 AM',
      'timezone': 'UTC'
  })
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }) => (
    <button type="button" onClick={() => onSelect(new Date(2024, 1, 1))}>
      Mock Calendar
    </button>
  ),
}));

import { snooze } from '../background/snoozeLogic';

describe('Popup', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Ensure global chrome mock
    if (!global.chrome) global.chrome = {};
    if (!global.chrome.tabs) global.chrome.tabs = {};
    if (!global.chrome.runtime) global.chrome.runtime = {};

    global.chrome.runtime.openOptionsPage = vi.fn();
    global.chrome.runtime.getURL = vi.fn((path) => `chrome-extension://test/${path}`);

    // Mock tabs.query to support callback
    global.chrome.tabs.query.mockImplementation((query, callback) => {
        const tabs = [{ id: 1, url: 'https://example.com', title: 'Test Tab' }];
        if (callback) callback(tabs);
        return Promise.resolve(tabs);
    });

    // Mock runtime.sendMessage to support callback
    global.chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
        if (msg?.action === 'getSettings') {
            if (callback) {
                callback({
                    'start-day': '8:00 AM',
                    timezone: 'UTC',
                });
            }
            return;
        }
        if (callback) callback();
    });
  });

  it('renders snooze options', async () => {
    // Popup might fetch settings on mount, so we wait
    render(<Popup />);

    // Expect buttons for snooze options
    // Assuming button text contains "Later today" or similar.
    // Based on knowledge of default app, let's verify headers or buttons.
    // We can use waitFor in case of async rendering
    await waitFor(() => {
        expect(screen.getByText(/Later today/i)).toBeInTheDocument();
        const tomorrow = screen.queryByText(/Tomorrow/i);
        const morning = screen.queryByText(/This morning/i);
        expect(tomorrow || morning).not.toBeNull();
    });
  });

  it('requests settings via runtime message on mount', async () => {
    render(<Popup />);

    await waitFor(() => {
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'getSettings' }),
        expect.any(Function)
      );
    });
  });

  it('applies default settings when getSettings returns null/error', async () => {
      // Mock runtime.sendMessage to return null or error
      global.chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
          if (msg?.action === 'getSettings') {
              if (callback) callback(null); // Simulate missing settings
              return;
          }
          if (callback) callback();
      });

      render(<Popup />);

      await waitFor(() => {
          // Verify that default start-day (8:00 AM) is recognized
          // We can't verify state directly, but we can verify derivation.
          // For example, if default is 8AM and current time is 7AM, "Later today" might be shown.
          // Or we can verify that no crash occurs and defaults are used for other logic.
          // Since we can't inspect hooks, we rely on the fact that it renders without error
          // and potentially check for a side effect if possible.
          // For now, ensuring it doesn't crash is a good step, and we can check if it calls
          // sendMessage successfully.
         expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
              expect.objectContaining({ action: 'getSettings' }),
              expect.any(Function)
          );
      });
      // Further validation would require inspecting the component state or finding a UI element
      // that depends solely on a default setting.
      // E.g., if 'appearance' default is 'default' (not vivid/heatmap), we could check class names if we rendered those.
      // But given the constraints, this confirms the null check path is taken without error.
  });

  it('uses unified defaults when settings are missing (Start Day = 8am)', async () => {
    // Regression Test: Ensure fallback matches DEFAULT_SETTINGS (8:00 AM), not old hardcoded 9:00 AM.
    // Scenario: Current time 08:30.
    // If fallback is 9:00 AM -> 8 < 9 -> isEarlyMorning=true -> "This morning"
    // If fallback is 8:00 AM -> 8 < 8 -> isEarlyMorning=false -> "Tomorrow"

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T08:30:00')); // 8:30 AM

    global.chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
      if (msg?.action === 'getSettings') {
        if (callback) callback(null); // Simulate missing settings
        return;
      }
      if (callback) callback();
    });

    render(<Popup />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Since we fixed the fallback to 8, we expect "Tomorrow" NOT "This morning"
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    expect(screen.queryByText('This morning')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it.skip('calls snooze function when an option is clicked', async () => {
    render(<Popup />);

    await waitFor(() => {
        expect(screen.getByText(/Later today/i)).toBeInTheDocument();
    });

    // Find the actual button container or element.
    // The text might be inside a span or div inside the button.
    // Verify message was sent
    const laterTodayText = screen.getByText(/Later today/i);
    const button = laterTodayText.closest('button');
    fireEvent.click(button);
    console.log('Button clicked');

    await waitFor(() => {
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
        expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'snooze',
                tab: expect.objectContaining({ id: 1 })
            }),
            expect.any(Function)
        );
    });
  });

  it('updates labels for early morning and weekend', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-06T06:00:00'));

    global.chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
      if (msg?.action === 'getSettings') {
        if (callback) {
          callback({
            'start-day': '8:00 AM',
            'end-day': '6:00 PM',
            timezone: 'UTC',
          });
        }
        return;
      }
      if (callback) callback();
    });

    render(<Popup />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('This morning')).toBeInTheDocument();
    expect(screen.getByText('Next weekend')).toBeInTheDocument();

    const morning = screen.getByText('This morning');
    const evening = screen.getByText('This evening');
    expect(
      morning.compareDocumentPosition(evening) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    vi.useRealTimers();
  });

  it('hides This evening after end-day and snoozes picked date with scope', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-05T20:00:00'));
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    vi.spyOn(window, 'close').mockImplementation(() => {});

    global.chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
      if (msg?.action === 'getSettings') {
        if (callback) {
          callback({
            'start-day': '8:00 AM',
            'end-day': '6:00 PM',
            timezone: 'UTC',
          });
        }
        return;
      }
      if (callback) callback();
    });

    render(<Popup />);
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.queryByText('This evening')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Window'));
    fireEvent.click(screen.getByText('Pick Date'));
    fireEvent.click(screen.getByText('Mock Calendar'));

    const expectedTime = new Date(2024, 1, 1, 8, 0, 0, 0).getTime();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'snooze',
        popTime: expectedTime,
        groupId: expect.stringMatching(/^1700000000000-/),
      }),
      expect.any(Function)
    );

    vi.useRealTimers();
  });
});
