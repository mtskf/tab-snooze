import type { StorageV2, SnoozedItemV2 } from '../types';

export interface TabDisplayItem {
  type: 'tab';
  data: SnoozedItemV2;
}

export interface GroupDisplayItem {
  type: 'group';
  groupId: string;
  groupItems: SnoozedItemV2[];
  popTime: number;
}

export type DisplayItem = TabDisplayItem | GroupDisplayItem;

export interface DayGroup {
  key: string;
  date: Date;
  displayItems: DisplayItem[];
}

/**
 * Filters V2 data by search query (title or URL)
 * Supports multiple keywords (space/comma separated) with AND condition.
 * Maintains items/schedule consistency.
 */
export function filterByQuery(v2Data: StorageV2, query: string): StorageV2 {
  if (!query || query.trim() === "") {
    return v2Data;
  }

  // Split by whitespace or comma, filter empty keywords
  const keywords = query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((k) => k.trim() !== "");

  if (keywords.length === 0) {
    return v2Data;
  }

  const filteredItems: Record<string, SnoozedItemV2> = {};

  // Filter items by title or URL (AND condition: all keywords must match)
  for (const [id, item] of Object.entries(v2Data.items || {})) {
    const title = (item.title || "").toLowerCase();
    const url = (item.url || "").toLowerCase();

    // All keywords must match in either title or URL
    const allMatch = keywords.every((k) => title.includes(k) || url.includes(k));
    if (allMatch) {
      filteredItems[id] = item;
    }
  }

  // Rebuild schedule to only include filtered item IDs
  const filteredSchedule: Record<string, string[]> = {};
  for (const [time, ids] of Object.entries(v2Data.schedule || {})) {
    const filteredIds = ids.filter((id) => filteredItems[id]);
    if (filteredIds.length > 0) {
      filteredSchedule[time] = filteredIds;
    }
  }

  return {
    version: 2,
    items: filteredItems,
    schedule: filteredSchedule,
  };
}

/**
 * Converts V2 data to DayGroup[] for display.
 * Groups tabs by day and window groups within each day.
 */
export function selectSnoozedItemsByDay(v2Data: StorageV2): DayGroup[] {
  if (!v2Data?.items || Object.keys(v2Data.items).length === 0) {
    return [];
  }

  const items = v2Data.items;

  // Group all items by day
  const dayMap = new Map<string, { date: Date; items: SnoozedItemV2[] }>();

  for (const item of Object.values(items)) {
    const date = new Date(item.popTime);
    const dayKey = date.toDateString();

    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, {
        date: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        items: [],
      });
    }
    dayMap.get(dayKey)!.items.push(item);
  }

  // Convert to DayGroup[] and process each day
  const result: DayGroup[] = [];

  for (const [dayKey, { date, items: dayItems }] of dayMap) {
    // Separate grouped and solo tabs
    const windowGroups = new Map<string, SnoozedItemV2[]>();
    const soloTabs: SnoozedItemV2[] = [];

    for (const item of dayItems) {
      if (item.groupId) {
        if (!windowGroups.has(item.groupId)) {
          windowGroups.set(item.groupId, []);
        }
        windowGroups.get(item.groupId)!.push(item);
      } else {
        soloTabs.push(item);
      }
    }

    // Build displayItems array
    const displayItems: DisplayItem[] = [];

    // Add solo tabs
    for (const tab of soloTabs) {
      displayItems.push({
        type: "tab",
        data: tab,
      });
    }

    // Add window groups
    for (const [groupId, groupItems] of windowGroups) {
      // Sort group items by popTime
      groupItems.sort((a, b) => a.popTime - b.popTime);

      displayItems.push({
        type: "group",
        groupId,
        groupItems,
        popTime: groupItems[0]?.popTime || 0,
      });
    }

    // Sort displayItems by popTime
    displayItems.sort((a, b) => {
      const timeA = a.type === "tab" ? a.data.popTime : a.popTime;
      const timeB = b.type === "tab" ? b.data.popTime : b.popTime;
      return timeA - timeB;
    });

    result.push({
      key: dayKey,
      date,
      displayItems,
    });
  }

  // Sort days by date ascending
  result.sort((a, b) => a.date.getTime() - b.date.getTime());

  return result;
}

/**
 * Returns the count of snoozed items
 */
export function selectTabCount(v2Data: StorageV2 | null | undefined): number {
  if (!v2Data?.items) {
    return 0;
  }
  return Object.keys(v2Data.items).length;
}
