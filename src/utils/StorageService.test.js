import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StorageService } from "./StorageService";

// V1 format helper
function makeValidV1Tabs() {
  return {
    tabCount: 1,
    "1700000000000": [
      {
        url: "https://example.com",
        title: "Example",
        creationTime: 1700000000000,
        popTime: 1700000000000,
      },
    ],
  };
}

// V2 format helper
function makeValidV2Data() {
  return {
    version: 2,
    items: {
      "tab-1": {
        id: "tab-1",
        url: "https://example.com",
        title: "Example",
        favicon: "",
        creationTime: 1700000000000,
        popTime: 1700000000000,
      },
    },
    schedule: {
      "1700000000000": ["tab-1"],
    },
  };
}

describe("StorageService", () => {
  describe("exportTabs", () => {
    let createObjectURLSpy;
    let revokeObjectURLSpy;
    let createElementSpy;
    let anchor;

    beforeEach(() => {
      createObjectURLSpy = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:export");
      revokeObjectURLSpy = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {});

      const originalCreate = document.createElement.bind(document);
      createElementSpy = vi
        .spyOn(document, "createElement")
        .mockImplementation((tag) => {
          if (tag === "a") {
            anchor = originalCreate("a");
            anchor.click = vi.fn();
            return anchor;
          }
          return originalCreate(tag);
        });
    });

    afterEach(() => {
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      createElementSpy.mockRestore();
    });

    it("throws when V2 data has no items", () => {
      expect(() =>
        StorageService.exportTabs({ version: 2, items: {}, schedule: {} })
      ).toThrow("No tabs to export.");
    });

    it("throws when data is empty object", () => {
      expect(() => StorageService.exportTabs({})).toThrow("No tabs to export.");
    });

    it("throws when data is null/undefined", () => {
      expect(() => StorageService.exportTabs(null)).toThrow(
        "No tabs to export."
      );
      expect(() => StorageService.exportTabs(undefined)).toThrow(
        "No tabs to export."
      );
    });

    it("creates a download for valid V2 data", () => {
      StorageService.exportTabs(makeValidV2Data());

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(anchor).toBeDefined();
      expect(anchor.download).toMatch(
        /^snooooze-export-\d{4}-\d{2}-\d{2}\.json$/
      );
      expect(anchor.click).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:export");
    });
  });

  describe("parseImportFile", () => {
    it("rejects invalid JSON", async () => {
      const file = new File(["{invalid"], "bad.json", {
        type: "application/json",
      });

      await expect(StorageService.parseImportFile(file)).rejects.toBeDefined();
    });

    it("rejects array data (not an object)", async () => {
      const file = new File([JSON.stringify(["not", "object"])], "bad.json", {
        type: "application/json",
      });

      await expect(StorageService.parseImportFile(file)).rejects.toThrow(
        "Invalid data structure that cannot be repaired"
      );
    });

    // V2 format tests
    it("parses valid V2 data", async () => {
      const v2Data = makeValidV2Data();
      const file = new File([JSON.stringify(v2Data)], "v2.json", {
        type: "application/json",
      });

      const result = await StorageService.parseImportFile(file);
      expect(result.version).toBe(2);
      expect(result.items["tab-1"]).toBeDefined();
      expect(result.schedule["1700000000000"]).toContain("tab-1");
    });

    it("sanitizes invalid V2 data by removing invalid schedule references", async () => {
      const invalidV2 = {
        version: 2,
        items: {
          "tab-1": {
            id: "tab-1",
            url: "https://example.com",
            title: "Valid Tab",
            creationTime: 1700000000000,
            popTime: 1700000000000,
          },
        },
        schedule: {
          "1700000000000": ["tab-1", "missing-id"], // missing-id doesn't exist in items
        },
      };
      const file = new File([JSON.stringify(invalidV2)], "invalid-v2.json", {
        type: "application/json",
      });

      const result = await StorageService.parseImportFile(file);
      expect(result.version).toBe(2);
      // Valid tab should remain
      expect(result.items["tab-1"]).toBeDefined();
      // missing-id should be removed from schedule (item doesn't exist)
      expect(result.schedule["1700000000000"]).toContain("tab-1");
      expect(result.schedule["1700000000000"]).not.toContain("missing-id");
    });

    // V1 format tests (backward compatibility)
    it("parses valid V1 data", async () => {
      const v1Data = makeValidV1Tabs();
      const file = new File([JSON.stringify(v1Data)], "v1.json", {
        type: "application/json",
      });

      const result = await StorageService.parseImportFile(file);
      // V1 data is returned as-is
      expect(result.tabCount).toBe(1);
      expect(result["1700000000000"]).toHaveLength(1);
    });

    it("repairs V1 data when tabCount is incorrect", async () => {
      const data = {
        tabCount: 99, // Wrong count
        "1700000000000": [
          {
            url: "https://example.com",
            title: "Example",
            creationTime: 1700000000000,
            popTime: 1700000000000,
          },
        ],
      };
      const file = new File([JSON.stringify(data)], "ok.json", {
        type: "application/json",
      });

      const result = await StorageService.parseImportFile(file);
      expect(result.tabCount).toBe(1); // Should be corrected
      expect(result["1700000000000"]).toHaveLength(1);
    });
  });
});
