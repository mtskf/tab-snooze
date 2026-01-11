/**
 * Format utilities for date, time, and URL display
 */

/**
 * Format a date as relative day label or localized full date.
 *
 * Returns "Today" or "Tomorrow" for the current day or next day,
 * otherwise returns full date in format like "Monday, January 15".
 *
 * Timezone behavior:
 * - Uses local timezone for comparison
 * - Date-only comparison (ignores time component)
 * - Handles DST transitions correctly
 *
 * @param date - Date to format
 * @returns Relative day string ("Today"/"Tomorrow") or formatted date
 *
 * @example
 * ```ts
 * formatDay(new Date()) // "Today"
 * formatDay(new Date(Date.now() + 86400000)) // "Tomorrow"
 * formatDay(new Date('2025-01-15')) // "Wednesday, January 15"
 * ```
 */
export function formatDay(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (target.getTime() === today.getTime()) {
    return "Today";
  }
  if (target.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  }

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a timestamp as localized time string in 12-hour format.
 *
 * Outputs time with minutes and AM/PM indicator using user's locale.
 * Hour component is displayed without leading zero (e.g., "2:30 PM" not "02:30 PM").
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Localized time string (e.g., "2:30 PM", "11:45 AM")
 *
 * @example
 * ```ts
 * formatTime(1705334400000) // "2:00 PM" (locale-dependent)
 * formatTime(Date.now()) // Current time like "3:45 PM"
 * ```
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Extract hostname from a URL string with safe error handling.
 *
 * Parses the URL and returns only the hostname portion.
 * Returns "Unknown" for invalid URLs or missing input.
 *
 * Error handling:
 * - undefined/null/empty string → "Unknown"
 * - URL exceeding 2048 characters (RFC 2616 limit) → "Unknown"
 * - Malformed URL (invalid protocol, etc.) → "Unknown"
 * - Valid URL → hostname only (without protocol/path)
 *
 * @param url - URL string to parse (can be undefined)
 * @returns Hostname extracted from URL, or "Unknown" on error
 *
 * @security URL length is limited to 2048 characters to prevent ReDoS attacks
 *
 * @example
 * ```ts
 * getHostname("https://example.com/path") // "example.com"
 * getHostname("chrome://extensions") // "extensions"
 * getHostname("invalid-url") // "Unknown"
 * getHostname(undefined) // "Unknown"
 * getHostname("http://example.com/" + "a".repeat(3000)) // "Unknown"
 * ```
 */
export function getHostname(url: string | undefined): string {
  // Prevent ReDoS attacks by limiting URL length (RFC 2616 recommended limit)
  if (!url || url.length > 2048) return "Unknown";
  try {
    return new URL(url).hostname;
  } catch {
    return "Unknown";
  }
}
