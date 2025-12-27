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

    it('should calculate tomorrow correctly (8:00 AM)', async () => {
      // getTime internally calls getSettings which defaults start-day to 8:00 AM
      const result = await getTime('tomorrow');
      expect(result.getDate()).toBe(16); // 15 + 1
      expect(result.getHours()).toBe(8);
    });

    it('should calculate this-evening correctly', async () => {
        // Mock time to morning 10AM. "This Evening" default is 5:00 PM (17:00)
        const result = await getTime('this-evening');
        expect(result.getDate()).toBe(15);
        expect(result.getHours()).toBe(17);
    });

    it('should return end-day time for this-evening even when past end-day (visibility handled by UI)', async () => {
        // Set time to 19:00 (7 PM) - past end-day
        vi.setSystemTime(new Date(2024, 0, 15, 19, 0, 0));

        // Now returns end-day time (17:00). UI hides this option when past end-day.
        const result = await getTime('this-evening');
        expect(result.getHours()).toBe(17);
        expect(result.getDate()).toBe(15);
    });

    it('should return today for tomorrow when current time is before start-day (early morning)', async () => {
        // Set time to 3:00 AM - before default start-day (8:00 AM)
        vi.setSystemTime(new Date(2024, 0, 15, 3, 0, 0));

        const result = await getTime('tomorrow');
        // Should stay on same date (15) since it's early morning
        expect(result.getDate()).toBe(15);
        expect(result.getHours()).toBe(8);
    });

    it('should return tomorrow for tomorrow when current time is after start-day', async () => {
        // Set time to 10:00 AM - after default start-day (8:00 AM)
        vi.setSystemTime(new Date(2024, 0, 15, 10, 0, 0));

        const result = await getTime('tomorrow');
        // Should be next day (16)
        expect(result.getDate()).toBe(16);
        expect(result.getHours()).toBe(8);
    });

    it('should return today evening for tomorrow-evening when before start-day', async () => {
        // Set time to 4:00 AM - before default start-day (8:00 AM)
        vi.setSystemTime(new Date(2024, 0, 15, 4, 0, 0));

        const result = await getTime('tomorrow-evening');
        // Should stay on same date (15), time at end-day (17:00)
        expect(result.getDate()).toBe(15);
        expect(result.getHours()).toBe(17);
    });
  });
});
