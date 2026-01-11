/**
 * Format utilities for date, time, and URL display
 */

/**
 * Format a date as relative day (Today/Tomorrow) or full date
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
 * Format a timestamp as localized time string (e.g., "2:30 PM")
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Extract hostname from a URL string
 */
export function getHostname(url: string | undefined): string {
  if (!url) return "Unknown";
  try {
    return new URL(url).hostname;
  } catch {
    return "Unknown";
  }
}
