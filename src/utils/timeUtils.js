import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { addMonths } from "date-fns";

export async function getTime(timeName) {
  console.log("timeName", timeName);

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
      // "This Evening" in zoned time
      // If "This Evening" (e.g. 6PM) is already past in zoned time, treat as "Later today" (+1 hour)
      if (zonedNow.getHours() >= getSettingsTime(settings["end-day"])) {
        result = new Date(zonedNow);
        result.setHours(result.getHours() + 1);
        result.setSeconds(0, 0);
      } else {
        setSettingsTime(result, settings["end-day"]);
      }
      break;
    case "tomorrow":
      if (zonedNow.getHours() < 5) {
        // If it's early morning (e.g., 2 AM), treat "Tomorrow" as "Today morning" (later today)
        // i.e., don't add a day.
        // Keeping date as "Today"
      } else {
        result.setDate(result.getDate() + 1);
      }
      break;
    case "tomorrow-evening":
      if (zonedNow.getHours() < 5) {
        // Same logic? If 2AM, "Tomorrow Evening" is "Today Evening"?
        // Original logic: if > 5, date + 1. Else date + 0.
        // So if 2AM, date + 0 (Today Evening).
        // If 9AM, date + 1 (Tomorrow Evening).
      } else {
        result.setDate(result.getDate() + 1);
      }
      setSettingsTime(result, settings["end-day"]);
      break;
    case "2-days-morning":
      if (zonedNow.getHours() > 5) {
        result.setDate(result.getDate() + 2);
      } else {
        result.setDate(result.getDate() + 1);
      }
      break;
    case "2-days-evening":
      if (zonedNow.getHours() > 5) {
        result.setDate(result.getDate() + 2);
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
    case "day-after-tomorrow":
      if (zonedNow.getHours() > 5) {
        result.setDate(result.getDate() + 2);
      } else {
        result.setDate(result.getDate() + 1);
      }
      break;
    case "next-monday":
      var daysToMonday = daysToNextDay(result.getDay(), 1); // 1 is Monday
      result.setDate(result.getDate() + daysToMonday);
      break;
    case "next-week":
      var daysToWeek = daysToNextDay(result.getDay(), settings["week-begin"]);
      result.setDate(result.getDate() + daysToWeek);
      break;
    case "in-a-week":
      result.setDate(result.getDate() + 7);
      break;
    case "next-month":
      result = addMonths(result, 1);
      break;
    case "in-a-month":
      result = addMonths(result, 1);
      break;
    case "someday":
      result = addMonths(result, parseInt(settings["someday"]));
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

  console.log("result", result);
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
    "start-day": "9:00 AM",
    "end-day": "6:00 PM",
    "start-weekend": "10:00 AM",
    "week-begin": 1,
    "weekend-begin": 6,
    "later-today": 1,
    someday: 3,
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
