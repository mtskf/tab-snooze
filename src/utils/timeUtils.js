import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { addMonths } from "date-fns";
import { DEFAULT_SETTINGS } from "./constants";
import { getSettings } from "../background/snoozeLogic";

export async function getTime(timeName) {
  const settings = await getSettings();
  const timezone =
    settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Current system time in UTC
  const now = new Date();

  // Convert to "Zoned Time" (a Date object where getHours() returns wall-clock time in target zone)
  // In date-fns-tz v3: toZonedTime(date, timeZone)
  const zonedNow = toZonedTime(now, timezone);
  var result = new Date(zonedNow); // Copy for manipulation

  setSettingsTime(result, settings["start-day"]); // Default "8:00 AM" or similar

  // Calculate target zoned time
  switch (timeName) {
    case "later-today":
      result = new Date(zonedNow); // Reset to "now"
      // Add hours (this is naive add, but works on "zoned" object for simple offsets)
      // Better: use result.setHours(result.getHours() + X)
      // User requested fixed 1 hour logic for "Later today"
      var hour = 1;
      result.setHours(result.getHours() + hour, 0, 0, 0);
      // Let's assume user wants exactly +3 hours from now, maybe rounded to nearest hour?
      // Looking at original code: it rounded seconds to 0.
      result.setMinutes(zonedNow.getMinutes()); // Keep minutes? Original logic setSeconds(0,0) then added hours.
      // Original: var roundedTargetNow = new Date(startTargetNow); roundedTargetNow.setSeconds(0,0);
      // result = new Date(roundedTargetNow.getTime() + ... * hour);
      // It seems it kept minutes.
      result.setSeconds(0, 0);
      break;
    case "this-evening":
      // Simply set to end-day time. Visibility is controlled by Popup (hidden when past end-day)
      setSettingsTime(result, settings["end-day"]);
      break;
    case "tomorrow":
      // Early Morning Exception: If current hour is before start-day time,
      // treat "Tomorrow" as "Today morning" (don't add a day)
      if (zonedNow.getHours() < getSettingsTime(settings["start-day"])) {
        // Keeping date as "Today"
      } else {
        result.setDate(result.getDate() + 1);
      }
      break;
    case "this-weekend":
      // daysToNextDay works on getDay() (0-6). Zoned object returns correct local day.
      var daysToWeekend = daysToNextDay(
        result.getDay(),
        settings["weekend-begin"],
      );
      result.setDate(result.getDate() + daysToWeekend);
      // Use start-day for consistency (no separate weekend start time)
      break;
    case "next-monday":
      var daysToMonday = daysToNextDay(result.getDay(), 1); // 1 is Monday
      result.setDate(result.getDate() + daysToMonday);
      break;
    case "in-a-week":
      result.setDate(result.getDate() + 7);
      break;
    case "in-a-month":
      result = addMonths(result, 1);
      break;
    case "pick-date":
      result = undefined;
      break;
    default:
      // default is now (zoned)
      result = new Date(zonedNow);
  }

  if (result) {
    // Convert "Zoned Wall Time" back to "System UTC Timestamp"
    // fromZonedTime(zonedDate, timeZone) -> UTC Date
    // This handles DST transitions correctly.
    // e.g. if "Tomorrow 9AM" doesn't exist (Spring Forward skip), it adjusts?
    // Actually fromZonedTime maps strictly. If ambiguous, date-fns-tz usually picks standard or daylight based on internal logic.
    return fromZonedTime(result, timezone);
  }

  return result;
}

function daysToNextDay(currentDay, nextDay) {
  if (currentDay > 6 || currentDay < 0 || nextDay > 6 || nextDay < 0) {
    return 0;
  }

  if (nextDay <= currentDay) {
    return 7 + nextDay - currentDay;
  } else {
    return nextDay - currentDay;
  }
}

/**
 * Parses a time string (e.g., "8:00 AM") and returns the hour (0-23).
 * Falls back to DEFAULT_SETTINGS['start-day'] hour if input is falsy.
 * @param {string|null|undefined} timeStr - Time string in "H:MM AM/PM" format
 * @returns {number} Hour in 24-hour format (0-23)
 */
export function parseTimeString(timeStr) {
  // Fallback to DEFAULT_SETTINGS['start-day'] if input is falsy
  // Use DEFAULT_START_HOUR which is computed at module load to avoid recursion
  if (!timeStr) return DEFAULT_START_HOUR;

  const timeParts = timeStr.split(/[\s:]+/);
  let hour = parseInt(timeParts[0]);
  const meridian = timeParts[2];

  if (meridian === "AM" && hour === 12) {
    hour = 0;
  }

  if (meridian === "PM" && hour < 12) {
    hour = hour + 12;
  }

  return hour;
}

// Compute default start hour once at module load (avoids recursion in parseTimeString)
const DEFAULT_START_HOUR = (() => {
  const timeStr = DEFAULT_SETTINGS['start-day'];
  if (!timeStr) return 8; // Ultimate fallback if DEFAULT_SETTINGS is misconfigured
  const timeParts = timeStr.split(/[\s:]+/);
  let hour = parseInt(timeParts[0]);
  const meridian = timeParts[2];
  if (meridian === 'AM' && hour === 12) hour = 0;
  if (meridian === 'PM' && hour < 12) hour += 12;
  return hour;
})();

// Internal alias for backward compatibility
function getSettingsTime(settingsTime) {
  return parseTimeString(settingsTime);
}

function setSettingsTime(result, settingsTime) {
  if (!settingsTime) return result;
  var hour = getSettingsTime(settingsTime);
  var timeParts = settingsTime.split(/[\s:]+/);
  var minute = parseInt(timeParts[1]);
  result.setHours(hour, minute, 0, 0);

  return result;
}
