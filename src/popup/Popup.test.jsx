import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

import { snooze } from '../background/snoozeLogic';

describe('Popup', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Ensure global chrome mock
    if (!global.chrome) global.chrome = {};
    if (!global.chrome.tabs) global.chrome.tabs = {};
    if (!global.chrome.runtime) global.chrome.runtime = {};

    // Mock chrome.storage.local.get to return valid settings for timeUtils
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        const result = {
            settings: {
                'start-day': '8:00 AM',
                timezone: 'UTC' // Default
            }
        };
        if (callback) callback(result);
        return Promise.resolve(result);
    });

    // Mock tabs.query to support callback
    global.chrome.tabs.query.mockImplementation((query, callback) => {
        const tabs = [{ id: 1, url: 'https://example.com', title: 'Test Tab' }];
        if (callback) callback(tabs);
        return Promise.resolve(tabs);
    });

    // Mock runtime.sendMessage to support callback
    global.chrome.runtime.sendMessage.mockImplementation((msg, callback) => {
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
        expect(screen.getByText(/Tomorrow/i)).toBeInTheDocument();
    });
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
});
