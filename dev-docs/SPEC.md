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
| **Later Today** | Current time + 1 hour. Minutes are preserved; seconds are cleared. | Fixed: +1 hour |
| **This Evening** | Today at `end-day`. <br> **Visibility:** Hidden when current time is past `end-day`. | `end-day`: 5:00 PM |
| **Tomorrow** | Tomorrow at `start-day`. <br> **Exception:** If current time is before `start-day`, uses the current calendar date. <br> **Label:** Displayed as "This morning" when before `start-day`. In Settings, shown as "Tomorrow / This morning (after midnight)". | `start-day`: 8:00 AM |
| **This Weekend** | Next occurrence of `weekend-begin` day (never the current day). Time is `start-day`. <br> **Label:** Displayed as "Next weekend" when current day is Saturday or Sunday. In Settings, shown as "This weekend / Next weekend (during weekend)". | `weekend-begin`: Saturday (6)<br>`start-day`: 8:00 AM |
| **Next Monday** | Next occurrence of Monday (never "today"). Time is `start-day`. | `start-day`: 8:00 AM |
| **In a Week** | Current date + 7 days at `start-day`. | `start-day`: 8:00 AM |
| **In a Month** | Current date + 1 month (using `date-fns/addMonths`) at `start-day`. | `start-day`: 8:00 AM |
| **Pick Date** | Selected date at `start-day` time. Calendar starts on Monday. (Handled in `Popup.jsx`; `getTime("pick-date")` returns `undefined`.) | `start-day`: 8:00 AM |

### 2.2. "Early Morning" Exception (Start-Day Threshold)
To prevent frustration when working late (e.g., at 2 AM), "Tomorrow" refers to the *logical* tomorrow (after waking up), which is effectively the calendar's "Today".
- **Rule:** If `Current Hour < start-day hour` (default 8 AM), "Tomorrow" uses the current calendar date instead of adding a day, and displays as "This morning".

## 3. Scope & Shortcuts

### 3.1. Scope Selection
- **Selected Tabs:** Only the currently highlighted tabs are snoozed. Even if multiple tabs are selected, they are stored individually (no `groupId`).
- **Current Window:** All tabs in the current window are snoozed together with a shared `groupId`.
- A `groupId` is **only** assigned when scope is explicitly "Window". Multi-selected tabs in "Selected" scope do **not** get a `groupId` and will restore in the current window, not a new one.

### 3.2. Keyboard Shortcuts
- **Single Key:** Triggers snooze for the corresponding option (e.g., 'T' for Tomorrow).
- **Modifier (Shift):** Temporarily toggles the scope to "Current Window" while held.
    - Example: `T` snoozes selected tabs to Tomorrow. `Shift + T` snoozes the entire window to Tomorrow.
- **DatePicker Scope Preservation:** When opening the DatePicker with `Shift + P`, the "Window" scope is preserved even after the Shift key is released. The scope at the time of opening is stored in `calendarScope` state.
- **Configurable:** Default shortcuts live in `src/utils/constants.js` and can be customized in Options.

## 4. Restore Logic

### 4.1. Trigger
- An alarm (`popCheck`) runs every **1 minute**.
- Checks for any snoozed items with `timestamp < Date.now()`.
- Skips restore if already restoring or if the browser is offline.

### 4.2. Grouping & Window Restoration
- Tabs snoozed as a "Window" share a `groupId`.
- *Current Behavior:* Tabs with a `groupId` are restored together in a **new window**. Ungrouped tabs are restored into the last focused window (fallbacks to a new window if none is available). Options page actions can also restore or delete an entire group.
- **No Confirmation for Single Group Deletion:** Deleting a single window group does not show a confirmation dialog. "Delete All" still requires confirmation.

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
- Badge text displays the current `tabCount` (number of snoozed tabs). Empty when count is 0.
- Updated automatically on every `setSnoozedTabs` and `setSettings` call via `updateBadge()`.
- Respects `settings.badge` preference ("true"/"false"). If "false", badge text is hidden.

## 6. Data Integrity

### 6.1. Backup System
- **Rotation**: 3 generations of backups stored as `snoozedTabs_backup_<timestamp>`.
- **Debounce**: Backup rotation is debounced by 2 seconds to avoid excessive writes during rapid snoozing.
- **Validation**: Data is validated before backup (must have `tabCount`, numeric timestamp keys, and valid tab entries with `url`, `creationTime`, `popTime`).

### 6.2. Recovery
- **Trigger**: If `snoozedTabs` is missing, non-object, or fails validation, recovery is attempted.
- **Process**: Backups are scanned newest-first; the first valid backup is restored.
- **Fallback**: If no valid backups exist, resets to `{ tabCount: 0 }`.
- **Notification**: Shows "Recovered X snoozed tabs from backup" with 5-minute deduplication.

### 6.3. Migration
- On first run after update, if valid data exists but no backups, an initial backup is created.

## 7. Storage & Limits

### 7.1. Storage Size Warning
- **Goal**: Prevent data loss by warning users when `chrome.storage.local` is nearing its quota (10MB in standard Chrome extensions, though `unlimitedStorage` permission usually raises this, purely local usage is monitored here against safe thresholds).
- **Metric**: Uses `chrome.storage.local.getBytesInUse`.
- **Thresholds**:
    - **Warning Level**: > 80% (approx 8.3MB).
    - **Clear Level**: < 70% (hysteresis to prevent flickering).
- **Triggers**: Checks on **startup** and **after every snoozedTabs write** (debounced 2s).
- **Notification**: Standard system notification (throttled to once every 24 hours). Clicking opens Options page.
- **In-App Banner**: Options page shows a destructive-colored alert when warning is active.
- **Firefox Compatibility**: Feature is disabled gracefully on Firefox as `getBytesInUse` is not supported for `local` storage in MV2/MV3 implementation contexts uniformly.
