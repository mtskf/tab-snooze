import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTime, parseTimeString } from './timeUtils';
import { DEFAULT_SETTINGS } from './constants';

const originalIntl = global.Intl;


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

    it('should return next Saturday for this-weekend when called on Saturday', async () => {
        // Set time to Saturday 2024-01-13 10:00 AM
        vi.setSystemTime(new Date(2024, 0, 13, 10, 0, 0)); // Saturday

        const result = await getTime('this-weekend');
        // daysToNextDay(6, 6) = 7 (next Saturday)
        // 13 + 7 = 20
        expect(result.getDate()).toBe(20);
        expect(result.getHours()).toBe(8); // start-day
    });

    it('should return next Saturday for this-weekend when called on Sunday', async () => {
        // Set time to Sunday 2024-01-14 10:00 AM
        vi.setSystemTime(new Date(2024, 0, 14, 10, 0, 0)); // Sunday

        const result = await getTime('this-weekend');
        // daysToNextDay(0, 6) = 6 (Saturday is 6 days away from Sunday)
        // 14 + 6 = 20
        expect(result.getDate()).toBe(20);
        expect(result.getHours()).toBe(8); // start-day
    });

    it('should return next Monday for next-monday', async () => {
        // Set time to Wednesday 2024-01-17
        vi.setSystemTime(new Date(2024, 0, 17, 10, 0, 0));
        const result = await getTime('next-monday');
        expect(result.getDay()).toBe(1);
        expect(result.getHours()).toBe(8);
    });

    it('should return in-a-week by adding 7 days', async () => {
        vi.setSystemTime(new Date(2024, 0, 15, 10, 0, 0));
        const result = await getTime('in-a-week');
        expect(result.getDate()).toBe(22);
    });

    it('should return in-a-month by adding one month', async () => {
        vi.setSystemTime(new Date(2024, 0, 31, 10, 0, 0));
        const result = await getTime('in-a-month');
        expect(result.getMonth()).toBe(1);
    });

    it('returns undefined for pick-date', async () => {
        const result = await getTime('pick-date');
        expect(result).toBeUndefined();
    });
  });

  describe('parseTimeString', () => {
    it('parses AM time correctly', () => {
      expect(parseTimeString('8:00 AM')).toBe(8);
      expect(parseTimeString('9:30 AM')).toBe(9);
      expect(parseTimeString('11:00 AM')).toBe(11);
    });

    it('parses PM time correctly', () => {
      expect(parseTimeString('5:00 PM')).toBe(17);
      expect(parseTimeString('6:30 PM')).toBe(18);
      expect(parseTimeString('11:00 PM')).toBe(23);
    });

    it('handles 12 AM (midnight) correctly', () => {
      expect(parseTimeString('12:00 AM')).toBe(0);
    });

    it('handles 12 PM (noon) correctly', () => {
      expect(parseTimeString('12:00 PM')).toBe(12);
    });

    it('returns DEFAULT_SETTINGS start-day hour for null/undefined input', () => {
      // DEFAULT_SETTINGS['start-day'] is '8:00 AM' = 8
      const expectedDefault = parseTimeString(DEFAULT_SETTINGS['start-day']);
      expect(parseTimeString(null)).toBe(expectedDefault);
      expect(parseTimeString(undefined)).toBe(expectedDefault);
      expect(parseTimeString('')).toBe(expectedDefault);
    });

    it('fallback should match DEFAULT_SETTINGS start-day (8:00 AM = 8)', () => {
      // Explicit assertion that fallback is 8, not 9
      expect(parseTimeString(null)).toBe(8);
    });
  });
});
