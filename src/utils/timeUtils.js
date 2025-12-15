export async function getTime(timeName) {
    console.log("timeName", timeName);

    const settings = await getSettings();
    const timezone = settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Current system time
    const now = new Date();

    // Get "Wall Clock" time in target timezone
    // We parse the localized string to create a Date object that "looks" like the time in target zone
    // but exists in local system context.
    const targetNowStr = now.toLocaleString("en-US", { timeZone: timezone });
    const targetNow = new Date(targetNowStr);
    const startTargetNow = new Date(targetNow); // Copy for delta calculation

    // Round to minutes (logic from original)
    targetNow.setSeconds(0, 0);

    var second = 1000;
    var minute = second * 60;
    var hour = minute * 60;

    var result = targetNow; // Work on this "shifted" date
    setSettingsTime(result, settings["start-day"]); // Default for most cases

    // Calculate wake-up time (Logic runs on "shifted" time)
    switch(timeName) {
    case "later-today":
            // Use original rounding logic on the shifted date
             var roundedTargetNow = new Date(startTargetNow);
             roundedTargetNow.setSeconds(0,0);
            result = new Date(roundedTargetNow.getTime() + parseInt(settings["later-today"]) * hour);
            break;
        case "this-evening":
        if(result.getHours() > getSettingsTime(settings["end-day"])) {
            result.setDate(result.getDate() + 1);
        }
            setSettingsTime(result, settings["end-day"]);
            break;
        case "tomorrow":
        if(startTargetNow.getHours() > 5) {
            result.setDate(result.getDate() + 1);
        } else {
            // It's early morning (e.g. 2 AM). "Tomorrow" usually implies the morning of the *next* wake cycle.
            // If I say "Tomorrow" at 2AM, I usually mean "When I wake up today".
            // But the label says "Tomorrow". The code implies: if < 5am, treat as today.
            result.setDate(result.getDate());
        }
            break;
        case "tomorrow-evening": // Keep logic for now, though button might be removed in UI
            if(startTargetNow.getHours() > 5) {
                result.setDate(result.getDate() + 1);
            }
            setSettingsTime(result, settings["end-day"]);
            break;
    case "2-days-morning":
        if(startTargetNow.getHours() > 5) {
            result.setDate(result.getDate() + 2);
        } else {
            result.setDate(result.getDate() + 1);
        }
        break;
    case "2-days-evening":
        if(startTargetNow.getHours() > 5) {
            result.setDate(result.getDate() + 2);
        } else {
            result.setDate(result.getDate() + 1);
        }
            setSettingsTime(result, settings["end-day"]);
            break;
        case "this-weekend":
            var daysToWeekend = daysToNextDay(result.getDay(), settings["weekend-begin"])
            result.setDate(result.getDate() + daysToWeekend);
            setSettingsTime(result, settings["start-weekend"]); // Use weekend start time
            break;
        case "day-after-tomorrow":
            if(startTargetNow.getHours() > 5) {
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
            result.setMonth(result.getMonth() + 1);
            break;
        case "in-a-month":
            result.setMonth(result.getMonth() + 1);
            break;
        case "someday":
            result.setMonth(result.getMonth() + parseInt(settings["someday"]));
            break;
        case "pick-date":
            result = undefined;
            break;
        default:
            // default is now
            result = new Date(startTargetNow);
    }

    if (result) {
        // Calculate Delta
        const delta = result.getTime() - startTargetNow.getTime();
        // apply delta to system time
        return new Date(now.getTime() + delta);
    }

    console.log("result", result);
    return result;
}

function daysToNextDay(currentDay, nextDay) {
    if(currentDay > 6 || currentDay < 0 || nextDay > 6 || nextDay < 0) {
        return 0;
    }

    if(nextDay <= currentDay) {
        return (7 + nextDay) - currentDay;
    } else {
        return nextDay - currentDay;
    }
}

function getSettingsTime(settingsTime) {
    if (!settingsTime) return 9; // Fallback
    var timeParts = settingsTime.split(/[\s:]+/);
    var hour = parseInt(timeParts[0]);
    var meridian = timeParts[2];

    if(meridian == "AM" && hour == 12) {
        hour = 0;
    }

    if(meridian == "PM" && hour < 12) {
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
        "later-today": 3,
        "someday": 3,
        "open-new-tab": "true",
        "badge": "true",
        "timezone": Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    if (!res.settings) {
         return defaults;
    }
    // Merge with defaults to ensure new keys exist
    return { ...defaults, ...res.settings };
}
