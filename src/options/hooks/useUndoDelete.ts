import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import type { SnoozedItemV2 } from '@/types';

const UNDO_DELAY_MS = 5000;

interface PendingDeletion {
  type: 'tab' | 'group';
  tab?: SnoozedItemV2;
  groupId?: string;
  tabIds: string[];
  timeoutId: ReturnType<typeof setTimeout>;
}

interface UseUndoDeleteProps {
  onDeleteTab: (tab: SnoozedItemV2) => void;
  onDeleteGroup: (groupId: string) => void;
}

interface UseUndoDeleteReturn {
  scheduleTabDelete: (tab: SnoozedItemV2) => void;
  scheduleGroupDelete: (groupId: string, tabs: SnoozedItemV2[]) => void;
  pendingTabIds: Set<string>;
}

export function useUndoDelete({
  onDeleteTab,
  onDeleteGroup,
}: UseUndoDeleteProps): UseUndoDeleteReturn {
  const [pendingTabIds, setPendingTabIds] = useState<Set<string>>(new Set());
  const pendingDeletionsRef = useRef<Map<string, PendingDeletion>>(new Map());

  // Store callbacks in refs to avoid dependency issues
  // This prevents cleanup from running when callbacks change (e.g., due to re-renders)
  const onDeleteTabRef = useRef(onDeleteTab);
  const onDeleteGroupRef = useRef(onDeleteGroup);

  // Keep refs in sync with latest callbacks
  useEffect(() => {
    onDeleteTabRef.current = onDeleteTab;
    onDeleteGroupRef.current = onDeleteGroup;
  });

  // Execute pending deletions on unmount (user left without clicking Undo)
  // Empty dependency array ensures this only runs on actual component unmount,
  // not when callbacks change (which would cause unexpected deletions)
  useEffect(() => {
    return () => {
      pendingDeletionsRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutId);
        // Execute deletion immediately - user confirmed by leaving the page
        if (pending.type === 'tab' && pending.tab) {
          onDeleteTabRef.current(pending.tab);
        } else if (pending.type === 'group' && pending.groupId) {
          onDeleteGroupRef.current(pending.groupId);
        }
      });
      pendingDeletionsRef.current.clear();
    };
  }, []);

  const removePendingTabIds = useCallback((tabIds: string[]) => {
    setPendingTabIds((prev) => {
      const next = new Set(prev);
      tabIds.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const scheduleTabDelete = useCallback(
    (tab: SnoozedItemV2) => {
      const deletionKey = `tab-${tab.id}`;

      // Add to pending
      setPendingTabIds((prev) => new Set(prev).add(tab.id));

      const timeoutId = setTimeout(() => {
        // Execute the actual delete
        onDeleteTab(tab);
        removePendingTabIds([tab.id]);
        pendingDeletionsRef.current.delete(deletionKey);
      }, UNDO_DELAY_MS);

      const pending: PendingDeletion = {
        type: 'tab',
        tab,
        tabIds: [tab.id],
        timeoutId,
      };
      pendingDeletionsRef.current.set(deletionKey, pending);

      const title = tab.title || 'Tab';
      const displayTitle = title.length > 30 ? `${title.slice(0, 30)}...` : title;

      toast(`"${displayTitle}" deleted`, {
        duration: UNDO_DELAY_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            // Cancel the deletion
            clearTimeout(timeoutId);
            removePendingTabIds([tab.id]);
            pendingDeletionsRef.current.delete(deletionKey);
          },
        },
      });
    },
    [onDeleteTab, removePendingTabIds]
  );

  const scheduleGroupDelete = useCallback(
    (groupId: string, tabs: SnoozedItemV2[]) => {
      const deletionKey = `group-${groupId}`;
      const tabIds = tabs.map((t) => t.id);

      // Add all tabs to pending
      setPendingTabIds((prev) => {
        const next = new Set(prev);
        tabIds.forEach((id) => next.add(id));
        return next;
      });

      const timeoutId = setTimeout(() => {
        // Execute the actual group delete
        onDeleteGroup(groupId);
        removePendingTabIds(tabIds);
        pendingDeletionsRef.current.delete(deletionKey);
      }, UNDO_DELAY_MS);

      const pending: PendingDeletion = {
        type: 'group',
        groupId,
        tabIds,
        timeoutId,
      };
      pendingDeletionsRef.current.set(deletionKey, pending);

      toast(`Window group (${tabs.length} tabs) deleted`, {
        duration: UNDO_DELAY_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            // Cancel the deletion
            clearTimeout(timeoutId);
            removePendingTabIds(tabIds);
            pendingDeletionsRef.current.delete(deletionKey);
          },
        },
      });
    },
    [onDeleteGroup, removePendingTabIds]
  );

  return {
    scheduleTabDelete,
    scheduleGroupDelete,
    pendingTabIds,
  };
}
