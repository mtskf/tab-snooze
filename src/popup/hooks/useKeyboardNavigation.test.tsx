import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import type { Scope } from '../components/ScopeSelector';

interface SnoozeItem {
  id: string;
  shortcuts: string[];
}

interface HarnessProps {
  items: SnoozeItem[];
  initialFocusedIndex?: number;
  initialScope?: Scope;
  initialCalendarOpen?: boolean;
  pickDateShortcut?: string | null;
  snoozedItemsShortcut?: string | null;
  settingsShortcut?: string | null;
  handlers: {
    handleSnooze: (id: string) => void;
    handleSnoozeWithScope: (id: string, scope: Scope) => void;
    handleOneMinuteSnooze: (scope: Scope) => void;
  };
}

function Harness({
  items,
  initialFocusedIndex = 0,
  initialScope = 'selected',
  initialCalendarOpen = false,
  pickDateShortcut = null,
  snoozedItemsShortcut = null,
  settingsShortcut = null,
  handlers,
}: HarnessProps) {
  const [focusedIndex, setFocusedIndex] = useState(initialFocusedIndex);
  const [scope, setScope] = useState<Scope>(initialScope);
  const [isCalendarOpen, setIsCalendarOpen] = useState(initialCalendarOpen);
  const [calendarScope, setCalendarScope] = useState<Scope>('selected');

  useKeyboardNavigation({
    items,
    focusedIndex,
    setFocusedIndex,
    setScope,
    scope,
    handleSnooze: handlers.handleSnooze,
    handleSnoozeWithScope: handlers.handleSnoozeWithScope,
    handleOneMinuteSnooze: handlers.handleOneMinuteSnooze,
    setIsCalendarOpen,
    setCalendarScope,
    isCalendarOpen,
    pickDateShortcut,
    snoozedItemsShortcut,
    settingsShortcut,
  });

  return (
    <div>
      <div data-testid="focused">{focusedIndex}</div>
      <div data-testid="scope">{scope}</div>
      <div data-testid="calendar-open">{String(isCalendarOpen)}</div>
      <div data-testid="calendar-scope">{calendarScope}</div>
      <input data-testid="input" />
    </div>
  );
}

const baseItems: SnoozeItem[] = [
  { id: 'later', shortcuts: ['L'] },
  { id: 'tomorrow', shortcuts: ['T'] },
];

const getHandlers = () => ({
  handleSnooze: vi.fn(),
  handleSnoozeWithScope: vi.fn(),
  handleOneMinuteSnooze: vi.fn(),
});

beforeEach(() => {
  vi.restoreAllMocks();

  globalThis.chrome = {
    runtime: {
      openOptionsPage: vi.fn(),
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    },
    tabs: {
      create: vi.fn(),
    },
  } as unknown as typeof chrome;

  vi.spyOn(window, 'close').mockImplementation(() => {});
});

describe('useKeyboardNavigation', () => {
  it('handles arrow navigation and scope changes', () => {
    const handlers = getHandlers();
    render(
      <Harness
        items={baseItems}
        handlers={handlers}
      />
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('scope')).toHaveTextContent('window');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('scope')).toHaveTextContent('selected');

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(screen.getByTestId('focused')).toHaveTextContent('1');

    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(screen.getByTestId('focused')).toHaveTextContent('0');

    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(screen.getByTestId('focused')).toHaveTextContent('2');
  });

  it('snoozes focused item on Enter and respects input focus', () => {
    const handlers = getHandlers();
    render(
      <Harness
        items={baseItems}
        handlers={handlers}
      />
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(handlers.handleSnooze).toHaveBeenCalledWith('later');

    const input = screen.getByTestId('input');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByTestId('focused')).toHaveTextContent('0');
  });

  it('opens calendar from focused pick date option', () => {
    const handlers = getHandlers();
    render(
      <Harness
        items={baseItems}
        initialFocusedIndex={baseItems.length}
        handlers={handlers}
      />
    );

    fireEvent.keyDown(window, { key: 'Enter', shiftKey: true });
    expect(screen.getByTestId('calendar-open')).toHaveTextContent('true');
    expect(screen.getByTestId('calendar-scope')).toHaveTextContent('window');
  });

  it('honors shortcut key for pick date', () => {
    const handlers = getHandlers();
    render(
      <Harness
        items={baseItems}
        handlers={handlers}
        pickDateShortcut="D"
      />
    );

    fireEvent.keyDown(window, { key: 'd' });
    expect(screen.getByTestId('calendar-open')).toHaveTextContent('true');
  });

  it('honors shortcut keys for snoozed items and settings', () => {
    const handlers = getHandlers();
    render(
      <Harness
        items={baseItems}
        handlers={handlers}
        snoozedItemsShortcut="S"
        settingsShortcut="G"
      />
    );

    fireEvent.keyDown(window, { key: 's' });
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'g' });
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://test/options/index.html#settings',
    });
  });

  it('closes the window on Escape when calendar is closed', () => {
    const handlers = getHandlers();
    render(
      <Harness
        items={baseItems}
        handlers={handlers}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.close).toHaveBeenCalled();
  });

  it('handles item shortcut and shift scope toggling', () => {
    const handlers = getHandlers();
    render(
      <Harness
        items={baseItems}
        handlers={handlers}
      />
    );

    fireEvent.keyDown(window, { key: 'Shift' });
    expect(screen.getByTestId('scope')).toHaveTextContent('window');

    fireEvent.keyDown(window, { key: 'l', shiftKey: true });
    expect(handlers.handleSnoozeWithScope).toHaveBeenCalledWith('later', 'window');

    fireEvent.keyUp(window, { key: 'Shift' });
    expect(screen.getByTestId('scope')).toHaveTextContent('selected');
  });

  it('triggers hidden jjj command and ignores input when calendar is open', () => {
    const handlers = getHandlers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    const { unmount } = render(
      <Harness
        items={baseItems}
        handlers={handlers}
        initialScope="window"
      />
    );

    fireEvent.keyDown(window, { key: 'j' });
    vi.advanceTimersByTime(100);
    fireEvent.keyDown(window, { key: 'j' });
    vi.advanceTimersByTime(100);
    fireEvent.keyDown(window, { key: 'j' });

    expect(handlers.handleOneMinuteSnooze).toHaveBeenCalledWith('window');

    unmount();
    render(
      <Harness
        items={baseItems}
        handlers={handlers}
        initialCalendarOpen={true}
      />
    );

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(screen.getByTestId('focused')).toHaveTextContent('0');

    vi.useRealTimers();
  });
});
