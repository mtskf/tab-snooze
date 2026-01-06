import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GlobalShortcutSettings from './GlobalShortcutSettings';

declare const global: typeof globalThis & {
  chrome: typeof chrome;
  navigator: Navigator;
};

const originalNavigator = global.navigator;

describe('GlobalShortcutSettings', () => {
    // Mock chrome
    beforeEach(() => {
        global.chrome = {
            tabs: {
                create: vi.fn()
            }
        } as unknown as typeof chrome;
    });

    afterEach(() => {
        // Restore navigator
        Object.defineProperty(global, 'navigator', {
            value: originalNavigator,
            writable: true
        });
    });

  it('renders the current shortcut', () => {
    render(<GlobalShortcutSettings extensionShortcut="Alt+S" />);
    expect(screen.getByText('Alt+S')).toBeInTheDocument();
  });

  it('renders "Not set" if no shortcut provided', () => {
    render(<GlobalShortcutSettings extensionShortcut={null} />);
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('opens chrome extensions shortcut page on click (Chrome)', () => {
    // Mock User Agent for Chrome
    Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Chrome' },
        writable: true
    });

    render(<GlobalShortcutSettings extensionShortcut="Alt+S" />);

    fireEvent.click(screen.getByRole('button'));

    expect(global.chrome.tabs.create).toHaveBeenCalledWith({ url: 'chrome://extensions/shortcuts' });
  });

  it('opens firefox addon page on click (Firefox)', () => {
     // Mock User Agent for Firefox
     Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Firefox' },
        writable: true
    });

    render(<GlobalShortcutSettings extensionShortcut="Alt+S" />);

    fireEvent.click(screen.getByRole('button'));

    expect(global.chrome.tabs.create).toHaveBeenCalledWith({ url: 'about:addons' });
  });
});
