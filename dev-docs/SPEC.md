# Functional Specifications

This document defines the functional behavior, business logic, and user interface rules for the Snooooze extension. It serves as the source of truth for "what the system does," distinct from `ARCHITECTURE.md` which explains "how it is built."

## 1. Terminology

| Term | Definition |
| :--- | :--- |
| **Snooze** | The action of closing a tab (or tabs) and scheduling it to be reopened at a later time. |
| **Restore** | The action of reopening a snoozed tab when its scheduled time arrives. |
| **Scope** | The target of the snooze action. Can be "Selected Tabs" (default) or "Current Window". |
| **Zoned Time** | Time calculated based on the user's system timezone (or manually configured timezone). |
| **Window Group** | Multiple tabs snoozed together (either when the user selects multiple tabs or snoozes a full window). Stored under a shared `groupId`. |

## 2. Snooze Logic & Timing

The core logic for calculating snooze times resides in `src/utils/timeUtils.js`.

### 2.1. Time Calculation Rules

All calculations are based on the **Current Zoned Time** (timezone comes from settings, falling back to the system timezone).

**Day-of-week settings:** `weekend-begin` and `week-begin` follow JavaScript `Date.getDay()` (0=Sunday, 6=Saturday).

| Option | Logic Specification | Default Setting |
| :--- | :--- | :--- |
| **Later Today** | Current time + 1 hour. Minutes are preserved; seconds are cleared. | `later-today`: stored, but not used in calculation |
| **This Evening** | Today at `end-day`. <br> **Exception:** If current time is already past `end-day`, it behaves like "Later Today" (+1 hour, seconds cleared). | `end-day`: 6:00 PM |
| **Tomorrow** | Tomorrow at `start-day`. <br> **Exception:** If current time is early morning (< 5:00 AM), it is treated as "Today" (current date) at `start-day`. | `start-day`: 9:00 AM |
| **Tomorrow Evening** | Tomorrow at `end-day`. <br> **Exception:** If current time is < 5:00 AM, it is treated as "Today" (current date) at `end-day`. | `end-day`: 6:00 PM |
| **This Weekend** | Next occurrence of `weekend-begin` day (never the current day). Time is `start-weekend`. | `weekend-begin`: Saturday (6)<br>`start-weekend`: 10:00 AM |
| **Next Monday** | Next occurrence of Monday (never "today"). Time is `start-day`. | `start-day`: 9:00 AM |
| **In a Week** | Current date + 7 days at `start-day`. | `start-day`: 9:00 AM |
| **In a Month** | Current date + 1 month (using `date-fns/addMonths`) at `start-day`. | `start-day`: 9:00 AM |
| **Pick Date** | Selected date at **9:00 AM** local time. (Handled in `Popup.jsx`; `getTime("pick-date")` returns `undefined` and does not apply the custom timezone setting.) | - |

**Additional supported (internal) time keys:** `next-week`, `next-month`, `day-after-tomorrow`, `2-days-morning`, `2-days-evening`, `someday`. These are implemented in `timeUtils.js` but not exposed in the current popup UI.

### 2.2. "Early Morning" Exception (The 5 AM Rule)
To prevent frustration when working late (e.g., at 2 AM), "Tomorrow" refers to the *logical* tomorrow (after waking up), which is effectively the calendar's "Today".
- **Rule:** If `Current Hour < 5`, "Tomorrow" and "Tomorrow Evening" use the current calendar date. The internal "day-after" and "2-days" options shift by +1 day instead of +2 in this window.

## 3. Scope & Shortcuts

### 3.1. Scope Selection
- **Selected Tabs:** Only the currently highlighted tabs are snoozed.
- **Current Window:** All tabs in the current window are snoozed.
- A shared `groupId` is assigned when multiple tabs are snoozed together or when the scope is "Current Window".

### 3.2. Keyboard Shortcuts
- **Single Key:** Triggers snooze for the corresponding option (e.g., 'T' for Tomorrow).
- **Modifier (Shift):** Temporarily toggles the scope to "Current Window" while held.
    - Example: `T` snoozes selected tabs to Tomorrow. `Shift + T` snoozes the entire window to Tomorrow.
- **Configurable:** Default shortcuts live in `src/utils/constants.js` and can be customized in Options.

## 4. Restore Logic

### 4.1. Trigger
- An alarm (`popCheck`) runs every **1 minute**.
- Checks for any snoozed items with `timestamp < Date.now()`.
- Skips restore if already restoring or if the browser is offline.

### 4.2. Grouping & Window Restoration
- Tabs snoozed as a "Window" share a `groupId`.
- *Current Behavior:* Tabs with a `groupId` are restored together in a **new window**. Ungrouped tabs are restored into the last focused window (fallbacks to a new window if none is available). Options page actions can also restore or delete an entire group.

## 5. UI & Themes

### 5.1. Appearance Modes
Defined in `src/utils/constants.js`.

- **Default:** Monochromatic Blue/Indigo. Professional and calm.
- **Vivid:** Semantic colors.
    - `Tomorrow`: Blue
    - `Weekend`: Green
    - `Evening`: Purple
    - `Later Today`: Cyan
- **Heatmap:** Urgency-based colors.
    - `Later Today`: Red (Critical)
    - `Evening`: Red-Orange
    - `Tomorrow`: Orange
    - `Weekend`: Yellow (Warm)

### 5.2. Badge
- Badge background is set to `#FED23B`.
- No badge text updates are implemented in the current service worker (the UI still stores `tabCount` in storage).
