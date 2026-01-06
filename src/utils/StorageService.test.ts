import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { StorageService } from "./StorageService";

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
  describe("downloadAsJson", () => {
    let createObjectURLSpy: MockInstance;
    let revokeObjectURLSpy: MockInstance;
    let createElementSpy: MockInstance;
    let anchor: HTMLAnchorElement;

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
        .mockImplementation((tag: string) => {
          if (tag === "a") {
            anchor = originalCreate("a") as HTMLAnchorElement;
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

    it("throws when data is null/undefined", () => {
      expect(() => StorageService.downloadAsJson(null)).toThrow(
        "No data to export."
      );
      expect(() => StorageService.downloadAsJson(undefined)).toThrow(
        "No data to export."
      );
    });

    it("creates a download for valid data", () => {
      StorageService.downloadAsJson(makeValidV2Data());

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(anchor).toBeDefined();
      expect(anchor.download).toMatch(
        /^snooooze-export-\d{4}-\d{2}-\d{2}\.json$/
      );
      expect(anchor.click).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:export");
    });

    it("uses custom filename when provided", () => {
      StorageService.downloadAsJson({ test: true }, "custom-file.json");

      expect(anchor.download).toBe("custom-file.json");
    });
  });

  describe("readJsonFile", () => {
    it("parses valid JSON file", async () => {
      const data = { test: "value", number: 123 };
      const file = new File([JSON.stringify(data)], "test.json", {
        type: "application/json",
      });

      const result = await StorageService.readJsonFile(file);
      expect(result).toEqual(data);
    });

    it("parses V2 format JSON", async () => {
      const v2Data = makeValidV2Data();
      const file = new File([JSON.stringify(v2Data)], "v2.json", {
        type: "application/json",
      });

      const result = await StorageService.readJsonFile(file) as typeof v2Data;
      expect(result.version).toBe(2);
      expect(result.items["tab-1"]).toBeDefined();
    });

    it("rejects invalid JSON", async () => {
      const file = new File(["{invalid"], "bad.json", {
        type: "application/json",
      });

      await expect(StorageService.readJsonFile(file)).rejects.toThrow(
        "Invalid JSON file"
      );
    });

    it("does NOT validate data (just parses)", async () => {
      // Invalid structure should still be parsed - validation is done by background
      const invalidData = {
        version: 2,
        items: "should be object",
        schedule: null,
      };
      const file = new File([JSON.stringify(invalidData)], "invalid.json", {
        type: "application/json",
      });

      const result = await StorageService.readJsonFile(file) as typeof invalidData;
      expect(result.version).toBe(2);
      expect(result.items).toBe("should be object");
    });
  });

});
