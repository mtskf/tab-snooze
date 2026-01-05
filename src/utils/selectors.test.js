import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  filterByQuery,
  selectSnoozedItemsByDay,
  selectTabCount,
} from "./selectors.js";

describe("selectors", () => {
  // Fixed time for consistent testing
  const MOCK_TIME = new Date("2024-01-15T10:00:00").getTime();
  const TODAY = new Date(MOCK_TIME);
  const TOMORROW = new Date(MOCK_TIME + 24 * 60 * 60 * 1000);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to create V2 data
  const createV2Data = (items = {}, schedule = {}) => ({
    version: 2,
    items,
    schedule,
  });

  const createItem = (
    id,
    popTime,
    { url = `https://example.com/${id}`, title = `Tab ${id}`, groupId } = {}
  ) => ({
    id,
    url,
    title,
    favicon: `https://example.com/favicon.ico`,
    popTime,
    creationTime: MOCK_TIME - 1000,
    ...(groupId && { groupId }),
  });

  describe("filterByQuery", () => {
    it("returns V2 data unchanged when query is empty", () => {
      const item1 = createItem("tab-1", MOCK_TIME + 1000);
      const item2 = createItem("tab-2", MOCK_TIME + 2000);
      const v2Data = createV2Data(
        { "tab-1": item1, "tab-2": item2 },
        { [MOCK_TIME + 1000]: ["tab-1"], [MOCK_TIME + 2000]: ["tab-2"] }
      );

      const result = filterByQuery(v2Data, "");

      expect(result).toEqual(v2Data);
    });

    it("filters items by title (case-insensitive)", () => {
      const item1 = createItem("tab-1", MOCK_TIME + 1000, {
        title: "GitHub Issue",
      });
      const item2 = createItem("tab-2", MOCK_TIME + 2000, {
        title: "React Docs",
      });
      const v2Data = createV2Data(
        { "tab-1": item1, "tab-2": item2 },
        { [MOCK_TIME + 1000]: ["tab-1"], [MOCK_TIME + 2000]: ["tab-2"] }
      );

      const result = filterByQuery(v2Data, "github");

      expect(result.version).toBe(2);
      expect(Object.keys(result.items)).toEqual(["tab-1"]);
      expect(result.items["tab-1"].title).toBe("GitHub Issue");
    });

    it("filters items by URL", () => {
      const item1 = createItem("tab-1", MOCK_TIME + 1000, {
        url: "https://github.com/repo",
      });
      const item2 = createItem("tab-2", MOCK_TIME + 2000, {
        url: "https://docs.google.com",
      });
      const v2Data = createV2Data(
        { "tab-1": item1, "tab-2": item2 },
        { [MOCK_TIME + 1000]: ["tab-1"], [MOCK_TIME + 2000]: ["tab-2"] }
      );

      const result = filterByQuery(v2Data, "google");

      expect(Object.keys(result.items)).toEqual(["tab-2"]);
    });

    it("maintains schedule/items consistency after filtering", () => {
      const time1 = MOCK_TIME + 1000;
      const time2 = MOCK_TIME + 2000;
      const item1 = createItem("tab-1", time1, { title: "Keep This" });
      const item2 = createItem("tab-2", time1, { title: "Remove This" });
      const item3 = createItem("tab-3", time2, { title: "Keep This Too" });
      const v2Data = createV2Data(
        { "tab-1": item1, "tab-2": item2, "tab-3": item3 },
        { [time1]: ["tab-1", "tab-2"], [time2]: ["tab-3"] }
      );

      const result = filterByQuery(v2Data, "Keep");

      // Only tab-1 and tab-3 should remain
      expect(Object.keys(result.items).sort()).toEqual(["tab-1", "tab-3"]);

      // Schedule should only contain IDs that exist in items
      expect(result.schedule[time1]).toEqual(["tab-1"]);
      expect(result.schedule[time2]).toEqual(["tab-3"]);
    });

    it("removes empty schedule entries after filtering", () => {
      const time1 = MOCK_TIME + 1000;
      const item1 = createItem("tab-1", time1, { title: "Remove" });
      const v2Data = createV2Data(
        { "tab-1": item1 },
        { [time1]: ["tab-1"] }
      );

      const result = filterByQuery(v2Data, "Nothing Matches");

      expect(Object.keys(result.items)).toEqual([]);
      expect(Object.keys(result.schedule)).toEqual([]);
    });

    it("handles empty V2 data", () => {
      const v2Data = createV2Data({}, {});

      const result = filterByQuery(v2Data, "anything");

      expect(result).toEqual({ version: 2, items: {}, schedule: {} });
    });

    it("filters with AND condition for space-separated keywords", () => {
      const item1 = createItem("tab-1", MOCK_TIME + 1000, {
        title: "GitHub Issue Tracker",
        url: "https://github.com/issues",
      });
      const item2 = createItem("tab-2", MOCK_TIME + 2000, {
        title: "GitHub Docs",
        url: "https://docs.github.com",
      });
      const item3 = createItem("tab-3", MOCK_TIME + 3000, {
        title: "React Docs",
        url: "https://reactjs.org",
      });
      const v2Data = createV2Data(
        { "tab-1": item1, "tab-2": item2, "tab-3": item3 },
        {
          [MOCK_TIME + 1000]: ["tab-1"],
          [MOCK_TIME + 2000]: ["tab-2"],
          [MOCK_TIME + 3000]: ["tab-3"],
        }
      );

      // "github issue" should match only tab-1 (both keywords must match)
      const result = filterByQuery(v2Data, "github issue");

      expect(Object.keys(result.items)).toEqual(["tab-1"]);
    });

    it("filters with AND condition for comma-separated keywords", () => {
      const item1 = createItem("tab-1", MOCK_TIME + 1000, {
        title: "GitHub Issue Tracker",
      });
      const item2 = createItem("tab-2", MOCK_TIME + 2000, {
        title: "GitHub Docs",
      });
      const v2Data = createV2Data(
        { "tab-1": item1, "tab-2": item2 },
        {
          [MOCK_TIME + 1000]: ["tab-1"],
          [MOCK_TIME + 2000]: ["tab-2"],
        }
      );

      // "github,issue" should match only tab-1
      const result = filterByQuery(v2Data, "github,issue");

      expect(Object.keys(result.items)).toEqual(["tab-1"]);
    });

    it("returns no results if any keyword does not match", () => {
      const item1 = createItem("tab-1", MOCK_TIME + 1000, {
        title: "GitHub Docs",
      });
      const v2Data = createV2Data(
        { "tab-1": item1 },
        { [MOCK_TIME + 1000]: ["tab-1"] }
      );

      // "github nomatch" should return empty (nomatch doesn't exist)
      const result = filterByQuery(v2Data, "github nomatch");

      expect(Object.keys(result.items)).toEqual([]);
    });

    it("handles whitespace-only query segments", () => {
      const item1 = createItem("tab-1", MOCK_TIME + 1000, {
        title: "Test Tab",
      });
      const v2Data = createV2Data(
        { "tab-1": item1 },
        { [MOCK_TIME + 1000]: ["tab-1"] }
      );

      // "  test  " should filter empty segments and match "test"
      const result = filterByQuery(v2Data, "  test  ");

      expect(Object.keys(result.items)).toEqual(["tab-1"]);
    });
  });

  describe("selectSnoozedItemsByDay", () => {
    it("returns empty array for empty V2 data", () => {
      const v2Data = createV2Data({}, {});

      const result = selectSnoozedItemsByDay(v2Data);

      expect(result).toEqual([]);
    });

    it("groups items by day", () => {
      const todayTime = TODAY.getTime() + 3600000; // Today + 1 hour
      const tomorrowTime = TOMORROW.getTime() + 3600000; // Tomorrow + 1 hour

      const item1 = createItem("tab-1", todayTime, { title: "Today Tab" });
      const item2 = createItem("tab-2", tomorrowTime, {
        title: "Tomorrow Tab",
      });
      const v2Data = createV2Data(
        { "tab-1": item1, "tab-2": item2 },
        { [todayTime]: ["tab-1"], [tomorrowTime]: ["tab-2"] }
      );

      const result = selectSnoozedItemsByDay(v2Data);

      expect(result.length).toBe(2);

      // First day should be today (sorted by popTime ascending)
      expect(result[0].key).toBe(TODAY.toDateString());
      expect(result[0].displayItems.length).toBe(1);
      expect(result[0].displayItems[0].type).toBe("tab");
      expect(result[0].displayItems[0].data.title).toBe("Today Tab");

      // Second day should be tomorrow
      expect(result[1].key).toBe(TOMORROW.toDateString());
    });

    it("sorts items within a day by popTime", () => {
      const time1 = TODAY.getTime() + 1000;
      const time2 = TODAY.getTime() + 2000;
      const time3 = TODAY.getTime() + 3000;

      const item1 = createItem("tab-1", time2, { title: "Middle" });
      const item2 = createItem("tab-2", time1, { title: "First" });
      const item3 = createItem("tab-3", time3, { title: "Last" });

      const v2Data = createV2Data(
        { "tab-1": item1, "tab-2": item2, "tab-3": item3 },
        { [time1]: ["tab-2"], [time2]: ["tab-1"], [time3]: ["tab-3"] }
      );

      const result = selectSnoozedItemsByDay(v2Data);

      expect(result.length).toBe(1);
      expect(result[0].displayItems.length).toBe(3);
      expect(result[0].displayItems[0].data.title).toBe("First");
      expect(result[0].displayItems[1].data.title).toBe("Middle");
      expect(result[0].displayItems[2].data.title).toBe("Last");
    });

    it("groups tabs with same groupId into window groups", () => {
      const time1 = TODAY.getTime() + 1000;
      const groupId = "window-group-1";

      const item1 = createItem("tab-1", time1, {
        title: "Group Tab 1",
        groupId,
      });
      const item2 = createItem("tab-2", time1, {
        title: "Group Tab 2",
        groupId,
      });
      const item3 = createItem("tab-3", time1, { title: "Solo Tab" }); // No groupId

      const v2Data = createV2Data(
        { "tab-1": item1, "tab-2": item2, "tab-3": item3 },
        { [time1]: ["tab-1", "tab-2", "tab-3"] }
      );

      const result = selectSnoozedItemsByDay(v2Data);

      expect(result.length).toBe(1);
      expect(result[0].displayItems.length).toBe(2); // 1 group + 1 solo tab

      // Find the group item
      const groupItem = result[0].displayItems.find((i) => i.type === "group");
      expect(groupItem).toBeDefined();
      expect(groupItem.groupId).toBe(groupId);
      expect(groupItem.groupItems.length).toBe(2);

      // Find the solo tab
      const soloTab = result[0].displayItems.find((i) => i.type === "tab");
      expect(soloTab).toBeDefined();
      expect(soloTab.data.title).toBe("Solo Tab");
    });

    it("uses earliest popTime for group sorting", () => {
      const time1 = TODAY.getTime() + 1000;
      const time2 = TODAY.getTime() + 2000;
      const time3 = TODAY.getTime() + 3000;
      const groupId = "window-group-1";

      // Group tabs at time1 and time2
      const item1 = createItem("tab-1", time1, { title: "Group Tab 1", groupId });
      const item2 = createItem("tab-2", time2, { title: "Group Tab 2", groupId });
      // Solo tab at time3
      const item3 = createItem("tab-3", time3, { title: "Solo Tab" });

      const v2Data = createV2Data(
        { "tab-1": item1, "tab-2": item2, "tab-3": item3 },
        { [time1]: ["tab-1"], [time2]: ["tab-2"], [time3]: ["tab-3"] }
      );

      const result = selectSnoozedItemsByDay(v2Data);

      // Group should come first (time1), then solo tab (time3)
      expect(result[0].displayItems[0].type).toBe("group");
      expect(result[0].displayItems[0].popTime).toBe(time1);
      expect(result[0].displayItems[1].type).toBe("tab");
      expect(result[0].displayItems[1].data.popTime).toBe(time3);
    });

    it("includes popTime in tab data", () => {
      const time1 = TODAY.getTime() + 1000;
      const item1 = createItem("tab-1", time1);
      const v2Data = createV2Data(
        { "tab-1": item1 },
        { [time1]: ["tab-1"] }
      );

      const result = selectSnoozedItemsByDay(v2Data);

      expect(result[0].displayItems[0].data.popTime).toBe(time1);
    });
  });

  describe("selectTabCount", () => {
    it("returns 0 for empty V2 data", () => {
      const v2Data = createV2Data({}, {});

      const result = selectTabCount(v2Data);

      expect(result).toBe(0);
    });

    it("returns correct count of items", () => {
      const item1 = createItem("tab-1", MOCK_TIME + 1000);
      const item2 = createItem("tab-2", MOCK_TIME + 2000);
      const item3 = createItem("tab-3", MOCK_TIME + 3000);
      const v2Data = createV2Data(
        { "tab-1": item1, "tab-2": item2, "tab-3": item3 },
        {}
      );

      const result = selectTabCount(v2Data);

      expect(result).toBe(3);
    });

    it("handles undefined/null gracefully", () => {
      expect(selectTabCount(null)).toBe(0);
      expect(selectTabCount(undefined)).toBe(0);
      expect(selectTabCount({})).toBe(0);
    });
  });
});
