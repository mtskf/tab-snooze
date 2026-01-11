import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDay, formatTime, getHostname } from "./formatUtils";

describe("formatUtils", () => {
  describe("formatDay", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns 'Today' for current date", () => {
      vi.setSystemTime(new Date(2024, 0, 15, 10, 0, 0));
      const today = new Date(2024, 0, 15);
      expect(formatDay(today)).toBe("Today");
    });

    it("returns 'Tomorrow' for next day", () => {
      vi.setSystemTime(new Date(2024, 0, 15, 10, 0, 0));
      const tomorrow = new Date(2024, 0, 16);
      expect(formatDay(tomorrow)).toBe("Tomorrow");
    });

    it("returns formatted date for other days", () => {
      vi.setSystemTime(new Date(2024, 0, 15, 10, 0, 0));
      const futureDate = new Date(2024, 0, 20);
      const result = formatDay(futureDate);
      // Should include weekday, month, and day
      expect(result).toContain("Saturday");
      expect(result).toContain("January");
      expect(result).toContain("20");
    });

    it("handles midnight edge case", () => {
      vi.setSystemTime(new Date(2024, 0, 15, 0, 0, 0));
      const today = new Date(2024, 0, 15, 23, 59, 59);
      expect(formatDay(today)).toBe("Today");
    });

    it("handles year boundary", () => {
      vi.setSystemTime(new Date(2024, 11, 31, 10, 0, 0));
      const tomorrow = new Date(2025, 0, 1);
      expect(formatDay(tomorrow)).toBe("Tomorrow");
    });

    it("handles DST transition (spring forward)", () => {
      // March 10, 2024 at 2 AM DST begins (in most US timezones)
      vi.setSystemTime(new Date(2024, 2, 10, 1, 0, 0));
      const today = new Date(2024, 2, 10, 3, 0, 0); // After DST transition
      expect(formatDay(today)).toBe("Today");
    });

    it("handles DST transition (fall back)", () => {
      // November 3, 2024 at 2 AM DST ends (in most US timezones)
      vi.setSystemTime(new Date(2024, 10, 3, 1, 0, 0));
      const today = new Date(2024, 10, 3, 1, 30, 0);
      expect(formatDay(today)).toBe("Today");
    });

    it("ignores time component when comparing dates", () => {
      vi.setSystemTime(new Date(2024, 0, 15, 23, 59, 0));
      const todayMorning = new Date(2024, 0, 15, 0, 0, 0);
      const todayEvening = new Date(2024, 0, 15, 23, 59, 59);
      expect(formatDay(todayMorning)).toBe("Today");
      expect(formatDay(todayEvening)).toBe("Today");
    });
  });

  describe("formatTime", () => {
    it("formats morning time correctly", () => {
      const timestamp = new Date(2024, 0, 15, 8, 30, 0).getTime();
      const result = formatTime(timestamp);
      expect(result).toMatch(/8:30\s*AM/i);
    });

    it("formats afternoon time correctly", () => {
      const timestamp = new Date(2024, 0, 15, 14, 45, 0).getTime();
      const result = formatTime(timestamp);
      expect(result).toMatch(/2:45\s*PM/i);
    });

    it("formats midnight correctly", () => {
      const timestamp = new Date(2024, 0, 15, 0, 0, 0).getTime();
      const result = formatTime(timestamp);
      expect(result).toMatch(/12:00\s*AM/i);
    });

    it("formats noon correctly", () => {
      const timestamp = new Date(2024, 0, 15, 12, 0, 0).getTime();
      const result = formatTime(timestamp);
      expect(result).toMatch(/12:00\s*PM/i);
    });

    it("uses 12-hour format without leading zeros", () => {
      const timestamp1 = new Date(2024, 0, 15, 1, 0, 0).getTime();
      const timestamp13 = new Date(2024, 0, 15, 13, 0, 0).getTime();
      const result1 = formatTime(timestamp1);
      const result13 = formatTime(timestamp13);
      // Should be "1:00 AM" not "01:00 AM"
      expect(result1).toMatch(/^1:00\s*AM/i);
      // Should be "1:00 PM" not "01:00 PM"
      expect(result13).toMatch(/^1:00\s*PM/i);
    });

    it("always includes minutes with 2 digits", () => {
      const timestamp = new Date(2024, 0, 15, 9, 5, 0).getTime();
      const result = formatTime(timestamp);
      // Should be "9:05 AM" not "9:5 AM"
      expect(result).toMatch(/9:05\s*AM/i);
    });

    it("handles 11:59 PM edge case", () => {
      const timestamp = new Date(2024, 0, 15, 23, 59, 0).getTime();
      const result = formatTime(timestamp);
      expect(result).toMatch(/11:59\s*PM/i);
    });
  });

  describe("getHostname", () => {
    it("extracts hostname from valid URL", () => {
      expect(getHostname("https://example.com/path")).toBe("example.com");
      expect(getHostname("https://www.google.com")).toBe("www.google.com");
    });

    it("handles URL with port", () => {
      expect(getHostname("http://localhost:3000")).toBe("localhost");
    });

    it("handles URL with authentication", () => {
      expect(getHostname("https://user:pass@example.com")).toBe("example.com");
    });

    it("returns 'Unknown' for undefined", () => {
      expect(getHostname(undefined)).toBe("Unknown");
    });

    it("returns 'Unknown' for empty string", () => {
      expect(getHostname("")).toBe("Unknown");
    });

    it("returns 'Unknown' for invalid URL", () => {
      expect(getHostname("not-a-url")).toBe("Unknown");
      expect(getHostname("://missing-protocol")).toBe("Unknown");
    });

    it("handles chrome:// URLs", () => {
      expect(getHostname("chrome://extensions")).toBe("extensions");
    });

    it("handles file:// URLs", () => {
      const result = getHostname("file:///path/to/file.html");
      expect(result).toBe("");
    });

    it("handles URLs with special characters in hostname", () => {
      expect(getHostname("https://sub-domain.example.com")).toBe(
        "sub-domain.example.com"
      );
      expect(getHostname("https://my_site.example.com")).toBe(
        "my_site.example.com"
      );
    });

    it("returns 'Unknown' for URLs with spaces", () => {
      expect(getHostname("https://example .com")).toBe("Unknown");
      expect(getHostname("not a url at all")).toBe("Unknown");
    });

    it("handles data: URLs", () => {
      // data: URLs have empty hostname
      expect(getHostname("data:text/html,<h1>Test</h1>")).toBe("");
    });

    it("handles about:blank and chrome special pages", () => {
      // about: URLs have empty hostname
      expect(getHostname("about:blank")).toBe("");
      expect(getHostname("chrome-extension://abcdef123456")).toBe(
        "abcdef123456"
      );
    });

    it("handles URLs with query parameters", () => {
      expect(getHostname("https://example.com?foo=bar&baz=qux")).toBe(
        "example.com"
      );
    });

    it("handles URLs with hash fragments", () => {
      expect(getHostname("https://example.com#section")).toBe("example.com");
      expect(getHostname("https://example.com/path#section?query=1")).toBe(
        "example.com"
      );
    });

    it("handles internationalized domain names (IDN)", () => {
      // Punycode representation
      expect(getHostname("https://xn--n3h.com")).toBe("xn--n3h.com");
    });

    describe("security - ReDoS prevention", () => {
      it("returns 'Unknown' for URLs exceeding 2048 characters", () => {
        // Create a URL that exceeds the RFC 2616 recommended limit
        const longUrl = "http://example.com/" + "a".repeat(2100);
        expect(getHostname(longUrl)).toBe("Unknown");
      });

      it("handles URLs exactly at 2048 character limit", () => {
        // Create a URL with exactly 2048 characters
        const padding = "a".repeat(2048 - "http://example.com/".length);
        const maxLengthUrl = "http://example.com/" + padding;
        expect(maxLengthUrl.length).toBe(2048);
        // Should still process (at the limit, not over)
        expect(getHostname(maxLengthUrl)).toBe("example.com");
      });

      it("returns 'Unknown' for extremely long URLs (10000+ chars)", () => {
        const veryLongUrl = "http://example.com/" + "a".repeat(10000);
        expect(getHostname(veryLongUrl)).toBe("Unknown");
      });

      it("handles URL length check before parsing", () => {
        // Verify that length check happens before URL parsing to prevent ReDoS
        const longInvalidUrl = "not-a-url" + "x".repeat(3000);
        // Should return "Unknown" due to length, not parsing error
        expect(getHostname(longInvalidUrl)).toBe("Unknown");
      });
    });
  });
});
