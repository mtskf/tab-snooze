import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTime } from './timeUtils';


describe('timeUtils', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default mock for chrome.storage.local.get to return empty object (using defaults)
    // or you can return specific settings
    chrome.storage.local.get.mockResolvedValue({});

    // Mock system time to a fixed point if needed,
    // but getTime uses new Date(), so we might need useFakeTimers
    vi.useFakeTimers();
    // Set a fixed date: 2024-01-15 (Monday) 10:00 AM
    const date = new Date(2024, 0, 15, 10, 0, 0);
    vi.setSystemTime(date);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getTime', () => {
    it('should calculate later-today correctly (default +1 hour)', async () => {
      const result = await getTime('later-today');
      // 10:00 -> 11:00
      expect(result.getHours()).toBe(11);
      expect(result.getDate()).toBe(15);
    });

    it('should calculate tomorrow correctly (9:00 AM)', async () => {
      // getTime internally calls getSettings which defaults start-day to 9:00 AM
      const result = await getTime('tomorrow');
      expect(result.getDate()).toBe(16); // 15 + 1
      expect(result.getHours()).toBe(9);
    });

    it('should calculate this-evening correctly', async () => {
        // Mock time to morning 10AM. "This Evening" default is 6:00 PM (18:00)
        const result = await getTime('this-evening');
        expect(result.getDate()).toBe(15);
        expect(result.getHours()).toBe(18);
    });

    it('should handle this-evening when already evening', async () => {
        // Set time to 19:00 (7 PM)
        vi.setSystemTime(new Date(2024, 0, 15, 19, 0, 0));

        // Logic says: if now >= end-day (18), treat as later-today (+1 hour)
        // 19 + 1 = 20
        const result = await getTime('this-evening');
        expect(result.getHours()).toBe(20);
        expect(result.getDate()).toBe(15);
    });
  });
});
