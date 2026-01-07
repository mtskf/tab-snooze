import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUndoDelete } from './useUndoDelete';
import type { SnoozedItemV2 } from '@/types';

// Mock toast from sonner
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    dismiss: vi.fn(),
  }),
}));

import { toast } from 'sonner';

describe('useUndoDelete', () => {
  const mockTab: SnoozedItemV2 = {
    id: 'tab-1',
    url: 'https://example.com',
    title: 'Example Tab',
    creationTime: Date.now(),
    popTime: Date.now() + 3600000,
  };

  const mockGroupTabs: SnoozedItemV2[] = [
    {
      id: 'tab-2',
      url: 'https://example.com/a',
      title: 'Tab A',
      creationTime: Date.now(),
      popTime: Date.now() + 3600000,
      groupId: 'group-1',
    },
    {
      id: 'tab-3',
      url: 'https://example.com/b',
      title: 'Tab B',
      creationTime: Date.now(),
      popTime: Date.now() + 3600000,
      groupId: 'group-1',
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns scheduleTabDelete and scheduleGroupDelete functions', () => {
    const onDeleteTab = vi.fn();
    const onDeleteGroup = vi.fn();

    const { result } = renderHook(() =>
      useUndoDelete({ onDeleteTab, onDeleteGroup })
    );

    expect(typeof result.current.scheduleTabDelete).toBe('function');
    expect(typeof result.current.scheduleGroupDelete).toBe('function');
    expect(typeof result.current.pendingTabIds).toBe('object');
  });

  it('shows toast when scheduling tab delete', () => {
    const onDeleteTab = vi.fn();
    const onDeleteGroup = vi.fn();

    const { result } = renderHook(() =>
      useUndoDelete({ onDeleteTab, onDeleteGroup })
    );

    act(() => {
      result.current.scheduleTabDelete(mockTab);
    });

    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining('deleted'),
      expect.objectContaining({
        action: expect.objectContaining({
          label: 'Undo',
        }),
      })
    );
  });

  it('adds tab to pendingTabIds when scheduled', () => {
    const onDeleteTab = vi.fn();
    const onDeleteGroup = vi.fn();

    const { result } = renderHook(() =>
      useUndoDelete({ onDeleteTab, onDeleteGroup })
    );

    expect(result.current.pendingTabIds.has(mockTab.id)).toBe(false);

    act(() => {
      result.current.scheduleTabDelete(mockTab);
    });

    expect(result.current.pendingTabIds.has(mockTab.id)).toBe(true);
  });

  it('executes delete after timeout', async () => {
    const onDeleteTab = vi.fn();
    const onDeleteGroup = vi.fn();

    const { result } = renderHook(() =>
      useUndoDelete({ onDeleteTab, onDeleteGroup })
    );

    act(() => {
      result.current.scheduleTabDelete(mockTab);
    });

    expect(onDeleteTab).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onDeleteTab).toHaveBeenCalledWith(mockTab);
  });

  it('removes tab from pendingTabIds after deletion', async () => {
    const onDeleteTab = vi.fn();
    const onDeleteGroup = vi.fn();

    const { result } = renderHook(() =>
      useUndoDelete({ onDeleteTab, onDeleteGroup })
    );

    act(() => {
      result.current.scheduleTabDelete(mockTab);
    });

    expect(result.current.pendingTabIds.has(mockTab.id)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.pendingTabIds.has(mockTab.id)).toBe(false);
  });

  it('cancels delete when undo action is called', () => {
    const onDeleteTab = vi.fn();
    const onDeleteGroup = vi.fn();

    // Capture the undo callback from toast call
    let undoCallback: (() => void) | undefined;
    vi.mocked(toast).mockImplementation((message, options) => {
      const action = options?.action;
      if (action && typeof action === 'object' && 'onClick' in action) {
        undoCallback = action.onClick as () => void;
      }
      return 'toast-id';
    });

    const { result } = renderHook(() =>
      useUndoDelete({ onDeleteTab, onDeleteGroup })
    );

    act(() => {
      result.current.scheduleTabDelete(mockTab);
    });

    expect(result.current.pendingTabIds.has(mockTab.id)).toBe(true);

    // Trigger undo before timeout
    act(() => {
      undoCallback?.();
    });

    // Advance past timeout
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Delete should NOT have been called
    expect(onDeleteTab).not.toHaveBeenCalled();
    expect(result.current.pendingTabIds.has(mockTab.id)).toBe(false);
  });

  it('schedules group delete for multiple tabs', () => {
    const onDeleteTab = vi.fn();
    const onDeleteGroup = vi.fn();

    const { result } = renderHook(() =>
      useUndoDelete({ onDeleteTab, onDeleteGroup })
    );

    act(() => {
      result.current.scheduleGroupDelete('group-1', mockGroupTabs);
    });

    // All tabs in group should be pending
    expect(result.current.pendingTabIds.has('tab-2')).toBe(true);
    expect(result.current.pendingTabIds.has('tab-3')).toBe(true);

    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining('2 tabs'),
      expect.objectContaining({
        action: expect.objectContaining({
          label: 'Undo',
        }),
      })
    );
  });

  it('executes group delete after timeout', () => {
    const onDeleteTab = vi.fn();
    const onDeleteGroup = vi.fn();

    const { result } = renderHook(() =>
      useUndoDelete({ onDeleteTab, onDeleteGroup })
    );

    act(() => {
      result.current.scheduleGroupDelete('group-1', mockGroupTabs);
    });

    expect(onDeleteGroup).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onDeleteGroup).toHaveBeenCalledWith('group-1');
  });

  it('cancels group delete when undo is called', () => {
    const onDeleteTab = vi.fn();
    const onDeleteGroup = vi.fn();

    let undoCallback: (() => void) | undefined;
    vi.mocked(toast).mockImplementation((message, options) => {
      const action = options?.action;
      if (action && typeof action === 'object' && 'onClick' in action) {
        undoCallback = action.onClick as () => void;
      }
      return 'toast-id';
    });

    const { result } = renderHook(() =>
      useUndoDelete({ onDeleteTab, onDeleteGroup })
    );

    act(() => {
      result.current.scheduleGroupDelete('group-1', mockGroupTabs);
    });

    act(() => {
      undoCallback?.();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onDeleteGroup).not.toHaveBeenCalled();
    expect(result.current.pendingTabIds.has('tab-2')).toBe(false);
    expect(result.current.pendingTabIds.has('tab-3')).toBe(false);
  });

  it('handles multiple pending deletions independently', () => {
    const onDeleteTab = vi.fn();
    const onDeleteGroup = vi.fn();

    const tab2: SnoozedItemV2 = {
      ...mockTab,
      id: 'tab-other',
      title: 'Other Tab',
    };

    let undoCallbacks: (() => void)[] = [];
    vi.mocked(toast).mockImplementation((message, options) => {
      const action = options?.action;
      if (action && typeof action === 'object' && 'onClick' in action) {
        undoCallbacks.push(action.onClick as () => void);
      }
      return `toast-${undoCallbacks.length}`;
    });

    const { result } = renderHook(() =>
      useUndoDelete({ onDeleteTab, onDeleteGroup })
    );

    act(() => {
      result.current.scheduleTabDelete(mockTab);
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      result.current.scheduleTabDelete(tab2);
    });

    // First undo (for mockTab)
    act(() => {
      undoCallbacks[0]?.();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // First tab should NOT be deleted (was undone)
    // Second tab should be deleted (3 seconds passed)
    expect(onDeleteTab).not.toHaveBeenCalledWith(mockTab);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Now second tab should be deleted
    expect(onDeleteTab).toHaveBeenCalledWith(tab2);
    expect(onDeleteTab).toHaveBeenCalledTimes(1);
  });

  it('executes pending deletions on unmount', () => {
    const onDeleteTab = vi.fn();
    const onDeleteGroup = vi.fn();

    const { result, unmount } = renderHook(() =>
      useUndoDelete({ onDeleteTab, onDeleteGroup })
    );

    act(() => {
      result.current.scheduleTabDelete(mockTab);
    });

    expect(onDeleteTab).not.toHaveBeenCalled();

    unmount();

    // Deletion should be executed immediately on unmount
    expect(onDeleteTab).toHaveBeenCalledWith(mockTab);
    expect(onDeleteTab).toHaveBeenCalledTimes(1);
  });

  it('executes pending group deletions on unmount', () => {
    const onDeleteTab = vi.fn();
    const onDeleteGroup = vi.fn();

    const { result, unmount } = renderHook(() =>
      useUndoDelete({ onDeleteTab, onDeleteGroup })
    );

    act(() => {
      result.current.scheduleGroupDelete('group-1', mockGroupTabs);
    });

    expect(onDeleteGroup).not.toHaveBeenCalled();

    unmount();

    // Group deletion should be executed immediately on unmount
    expect(onDeleteGroup).toHaveBeenCalledWith('group-1');
    expect(onDeleteGroup).toHaveBeenCalledTimes(1);
  });
});
