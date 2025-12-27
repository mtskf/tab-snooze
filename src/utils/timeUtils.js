import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { addMonths } from "date-fns";

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

  setSettingsTime(result, settings["start-day"]); // Default "9:00 AM" or similar

  // Calculate target zoned time
  switch (timeName) {
    case "later-today":
      result = new Date(zonedNow); // Reset to "now"
      // Add hours (this is naive add, but works on "zoned" object for simple offsets)
      // Better: use result.setHours(result.getHours() + X)
      // User requested fixed 1 hour logic for "Later today"
      var hour = 1;
      result.setHours(result.getHours() + hour, 0, 0, 0); // Reset minutes/seconds? Original logic implies rounding?
      // Original logic: parseInt(settings["later-today"]) * hour + roundedTargetNow.getTime().
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
    case "tomorrow-evening":
      // Early Morning Exception: Same as "tomorrow"
      if (zonedNow.getHours() < getSettingsTime(settings["start-day"])) {
        // Today Evening
      } else {
        result.setDate(result.getDate() + 1);
      }
      setSettingsTime(result, settings["end-day"]);
      break;
    case "this-weekend":
      // daysToNextDay works on getDay() (0-6). Zoned object returns correct local day.
      var daysToWeekend = daysToNextDay(
        result.getDay(),
        settings["weekend-begin"],
      );
      result.setDate(result.getDate() + daysToWeekend);
      setSettingsTime(result, settings["start-weekend"]);
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

function getSettingsTime(settingsTime) {
  if (!settingsTime) return 9; // Fallback
  var timeParts = settingsTime.split(/[\s:]+/);
  var hour = parseInt(timeParts[0]);
  var meridian = timeParts[2];

  if (meridian == "AM" && hour == 12) {
    hour = 0;
  }

  if (meridian == "PM" && hour < 12) {
    hour = hour + 12;
  }

  return hour;
}

function setSettingsTime(result, settingsTime) {
  if (!settingsTime) return result;
  var hour = getSettingsTime(settingsTime);
  var timeParts = settingsTime.split(/[\s:]+/);
  var minute = parseInt(timeParts[1]);
  result.setHours(hour, minute, 0, 0);

  return result;
}

export async function getSettings() {
  const res = await chrome.storage.local.get("settings");
  const defaults = {
    "start-day": "8:00 AM",
    "end-day": "5:00 PM",
    "start-weekend": "10:00 AM",
    "week-begin": 1,
    "weekend-begin": 6,
    "later-today": 1,
    "open-new-tab": "true",
    badge: "true",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  if (!res.settings) {
    return defaults;
  }
  // Merge with defaults to ensure new keys exist
  return { ...defaults, ...res.settings };
}
