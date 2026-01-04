# Architecture Decision Records

Documents significant architectural decisions made during development.

## ADR-001: Revert Window Grouping
- **Context**: We initially implemented a feature to group snoozed tabs by their original "Window" in the Options UI.
- **Decision**: We reverted this change.
- **Consequences**: Snoozed tabs are stored and displayed individually. This simplifies the restoration logic and gives users more granular control over individual tabs, while still allowing them to snooze a whole window at once (creates multiple individual snooze entries).

## ADR-002: Restoration Target by Scope
- **Context**: Users snooze either selected tabs or an entire window. The restore target should stay consistent with that scope.
- **Decision**: Restoration is based on snooze scope, not a global setting.
    - **Window snoozes** restore in a *new window* to preserve the group context.
    - **Single/selected snoozes** restore into the *last focused window*.
- **Consequences**: Behavior is predictable and aligns with the original snooze intent. The Options "Open in New Tab" setting does not control restoration.

## ADR-003: Timezone Handling
- **Context**: Browsers run on system time, but accurate timezone handling can be complex.
- **Decision**: We use the browser's built-in `Intl.DateTimeFormat().resolvedOptions().timeZone` to detect the system timezone automatically.
- **Consequences**: The manual timezone selector is removed from the UI, simplifying the user experience. Snooze times are calculated based on the precise system timezone (IANA ID), ensuring accuracy without user configuration.

## ADR-004: Export/Import Format
- **Context**: Users may want to backup/restore snoozed tabs or transfer data between computers.
- **Decision**: Use a custom JSON format that mirrors the internal storage structure.
- **Consequences**: Ensures full fidelity of data (preserves snoozed time, creation time, original favicon, and "open in new window" preference). While not directly compatible with OneTab's text format, it prevents data loss during backup/restore cycles.

## ADR-005: Shift+Shortcut Scope Switching
- **Context**: Users need a quick way to toggle between snoozing selected tabs vs. entire window.
- **Decision**: Use `e.shiftKey` directly in keyboard handler rather than relying on React state for immediate scope detection.
- **Consequences**: Shift+L correctly snoozes all window tabs while L alone snoozes only selected. Visual state updates when Shift is held for user feedback.

## ADR-006: Options Page Search
- **Context**: Users with many snoozed tabs found it difficult to locate specific items.
- **Decision**: Implemented a client-side search filter in `Options.jsx` that matches against both Title and URL.
- **Consequences**: `SnoozedList` remains a presentational component. The search supports space/comma-separated "AND" logic (e.g., "google work" finds tabs matching both terms).

## ADR-007: Calendar Modal Overlay
- **Context**: The standard `Popover` for calendar selection felt too subtle and sometimes closed unexpectedly.
- **Decision**: Replaced the `Popover` with a full-screen semi-transparent (`bg-black/30`) modal overlay.
- **Consequences**: Provides stronger focus on the "Pick Date" action. The calendar is centered, and clicking the overlay reliably dismisses it.

## ADR-008: Custom Calendar Dropdown
- **Context**: `react-day-picker` v8's default dropdowns are native unstyled elements, while Shadcn UI typically uses its own `Select` component (which is complex to integrate cleanly into v8 due to focus management).
- **Decision**: Implemented a custom `Dropdown` component that layers an invisible native `<select>` over a purely visual label + chevron.
- **Consequences**: Achieves the visual fidelity of Shadcn's design system while leveraging the robust, accessible native navigation logic of `react-day-picker`.

## ADR-009: Single-Letter Hotkeys
- **Context**: Originally each snooze option had two shortcuts (number + letter), making the UI cluttered and hard to remember.
- **Decision**: Simplified to single-letter shortcuts only (L, E, T, S, N, W, M, P for Pick Date).
- **Consequences**: Cleaner UI with one shortcut badge per option. Users can still customize shortcuts in Settings. The "Pick Date" option is now also configurable.

## ADR-010: Options Page Component Split
- **Context**: `Options.jsx` was becoming monolithic, mixing layout code for distinct sections (Time, Shortcuts, Global Actions) with state management.
- **Decision**: Extracted logical sections into separate components: `TimeSettings`, `GlobalShortcutSettings`, and `SnoozeActionSettings`.
- **Consequences**: `Options.jsx` is now a cleaner orchestrator. Logic for each section is encapsulated, making maintenance and future updates (like adding more settings) much easier.

## ADR-011: Appearance Themes
- **Context**: Users interpret color differently; some prefer a calm monochromatic look ("Neo Carbon"), while others need strong visual cues for urgency or categorization.
- **Decision**: Introduced an "Appearance" setting with three distinct themes:
    1. **Default**: Monochromatic Blue/Indigo gradient (Calm, Professional).
    2. **Vivid**: Semantic colors distinct for each time option (Cyan, Purple, Green, Yellow, etc.).
    3. **Warm Heatmap**: Gradient from Red (Urgent/Critical) to Orange/Yellow (Distant) to visualize priority.
- **Consequences**:
    - `constants.js` now exports `DEFAULT_COLORS`, `VIVID_COLORS`, and `HEATMAP_COLORS`.
    - Components (`Popup`, `ShortcutEditor`, `SnoozedList`) subscribe to `settings.appearance` to dynamically resolve Tailwind color classes.
    - "Delete" actions also inherit the theme's critical color (e.g., Rose for Vivid, Red for Heatmap).

## ADR-012: Auto Backup Fallback
- **Context**: Users reported data loss when `snoozedTabs` storage became corrupted (cause unknown, possibly browser crash or extension update race).
- **Decision**: Implement automatic backup and recovery system.
    - 3 rotating backups with 2-second debounce to avoid I/O spam during rapid snoozing.
    - Validation on read (`getValidatedSnoozedTabs`) with auto-recovery from backup.
    - Recovery notification with 5-minute deduplication via `chrome.storage.session`.
- **Consequences**:
    - New `src/utils/validation.js` for data integrity checks.
    - `initStorage()` now validates and creates initial backup for existing users (migration).
    - Slight storage overhead (~3x for backups), acceptable for data safety.

## ADR-013: Storage Size Warning & Hysteresis
- **Context**: `chrome.storage.local` has a quota (5MB default, unnecessary to hit but implementations vary). If storage fills up, writes fail silently or with errors, causing data loss.
- **Decision**: Monitor usage with `getBytesInUse(null)` against a 10MB baseline (safe upper bound for most contexts with `unlimitedStorage`).
    - **Hysteresis**: Warn at 80%, only clear warning when usage drops below 70%. Prevents warning "flickering" if user deletes just one tab.
    - **Throttling**: Notifications limited to once per 24 hours to avoid annoyance.
    - **Firefox Handling**: `getBytesInUse` is missing in Firefox for local storage. We wrap calls in try-catch and silently disable the check features.
- **Consequences**: Users get advanced warning before catastrophic failure. Options page banner provides persistent visual cue. Firefox users don't get warnings but also don't get crashes.

## ADR-014: Centralized Import Validation
- **Context**: `Options.jsx` had a weak local `validateImportData` that only checked for `parseInt`-able keys and presence of `url`/`title`. This allowed malformed data (missing `creationTime`, `popTime`) to be imported, causing issues downstream.
- **Decision**: Replace local validation with the shared `validateSnoozedTabs` from `src/utils/validation.js`.
- **Consequences**: Import now enforces the same strict schema as the backup/recovery system. Invalid imports are rejected with detailed error logging. Single source of truth for data validation.


## ADR-016: Calendar Keyboard Conflict Resolution
- **Context**: When the DatePicker calendar was open, global keyboard shortcuts (Arrow keys, Enter, letter shortcuts) still fired, causing accidental snoozes or focus jumps.
- **Decision**: Pass `isCalendarOpen` state from `Popup.jsx` to `useKeyboardNavigation` hook. If true, the handler returns early, disabling all global shortcuts.
- **Consequences**: Calendar navigation is unobstructed. Users can use arrows and Enter within the calendar without side effects. Escape still closes the calendar (handled by the modal overlay).

## ADR-017: Defensive Storage Access
- **Context**: Code review identified that `getSnoozedTabs()` could return `undefined` if storage was cleared or corrupted, and subsequent code would crash trying to access properties.
- **Decision**: Add explicit null/undefined guards at the start of all functions that depend on `snoozedTabs`:
    - `addSnoozedTab`: Initialize to `{ tabCount: 0 }` if missing.
    - `removeSnoozedTabWrapper`, `removeWindowGroup`, `restoreWindowGroup`: Return early if missing.
- **Consequences**: Extension is resilient to storage clearing (via DevTools or browser reset). No crashes, no data corruption—just graceful no-ops.

## ADR-018: Prioritize Storage Persistence (Safe Snooze)
- **Context**: Previous implementation closed the tab *before* confirming it was saved to storage. If the storage write failed (e.g., quota exceeded), the user lost the tab permanently.
- **Decision**: Invert the order of operations in `snooze()`.
    1. Write to `chrome.storage.local`.
    2. Wait for success/mutex release.
    3. Close the tab.
- **Consequences**: If storage fails, the write promise rejects, the error is caught, and the tab **remains open**. Data safety is prioritized over UI responsiveness (though the delay is usually negligible).

## ADR-019: Fail-Safe Restoration
- **Context**: During restoration (`popCheck`), if creating a new window or tab failed (e.g., invalid URL), the entire batch was sometimes removed from storage, causing data loss.
- **Decision**: `restoreTabs` now tracks success/failure per tab.
    - Only successfully restored tabs are removed from storage.
    - Tabs that throw errors during creation remain in storage (preserved).
- **Consequences**: Ensures zero data loss even in edge cases (browser glitches, invalid restored URLs). Failed tabs stay in the list (or reappear) so the user can try again or manually copy the URL.

## ADR-020: Remove "Open in New Tab" Setting
- **Context**: The codebase contained an `openInNewWindow` flag and setting, but it was inconsistently applied and effectively unused by the restoration logic (which enforces New Window for groups and Last Focused for singles).
- **Decision**: Clean up the codebase by completely removing the `openInNewWindow` parameter and setting.
- **Consequences**: Reduced cognitive load and potential for bugs. Restoration behavior is now purely determined by **Snooze Scope** (see ADR-002), which is the intended design.

## ADR-021: Repairable Import Validation
- **Context**: Users trying to import `snoozedTabs` JSON sometimes faced rejection due to minor inconsistencies (e.g., `tabCount` mismatch) even if the tab data itself was valid.
- **Decision**: Enhance `validateSnoozedTabs` to return a `repairable` flag.
    - If `valid: false` but `repairable: true`, the Options UI offers to "Sanitize & Import".
    - Sanitization recalculates `tabCount` and filters out strictly invalid entries while keeping the partial valid data.
- **Consequences**: Better UX for users restoring backups from slightly different versions or manually edited files. Prevents "all or nothing" rejection.

## ADR-022: Centralize Import/Export Logic
- **Context**: `Options.jsx` contained file reading, JSON parsing, validation, sanitization, and merge logic, making UI code harder to maintain and test.
- **Decision**: Move import/export workflows into `src/utils/StorageService.js` and keep the Options UI as a thin caller that only handles success/error messaging.
- **Consequences**: Import/export behavior is reusable and testable in isolation. UI code is simpler, and validation/sanitization is consistently applied via the shared service.

## ADR-023: Popup Settings via Background
- **Context**: Popup read settings from `chrome.storage.local` directly, which drifted from the V2 data flow and bypassed the background’s adapter logic.
- **Decision**: Fetch settings through the background message API (`getSettings`) to keep a single access path for UI state.
- **Consequences**: Popup stays consistent with background-managed defaults and avoids direct storage coupling.

## ADR-024: Import Merge Uses Background Data
- **Context**: Import previously merged against `chrome.storage.local.snoozedTabs` (legacy) and could overwrite current V2 data.
- **Decision**: Fetch current data via the background (`getSnoozedTabs`) before merge, then persist with `setSnoozedTabs`.
- **Consequences**: Import respects the V2 source of truth and avoids data loss when legacy keys are absent.

## ADR-025: Startup V2 Recovery Notification
- **Context**: Corrupt V2 data was not triggering recovery or user notification on startup.
- **Decision**: Validate `snoooze_v2` in `initStorage()` and, on failure, recover from backups and set `pendingRecoveryNotification` in session storage.
- **Consequences**: Recovery runs automatically on startup and a user-facing notification can be shown by the service worker.

## ADR-026: V2 Normalized Storage Schema
- **Context**: V1 storage used a time-indexed array format (`{ timestamp: [tab1, tab2] }`). This made looking up specific tabs by ID (for removal or de-duplication) O(N) and complex. It also tied data strictly to time buckets.
- **Decision**: Migrate to a normalized relational model:
    - `items`: Map of `uuid -> TabData`.
    - `schedule`: Map of `timestamp -> [uuid]`.
- **Consequences**:
    - **O(1) Access**: Tabs can be looked up, updated, or removed by ID instantly.
    - **Flexibility**: Scheduling logic is decoupled from tab data. A tab can be rescheduled just by moving its UUID in `schedule`.
    - **Deduplication**: UUIDs enforce uniqueness.
    - **Migration**: Requires a migration step to convert V1 data to V2 on startup. `snoozeLogic.js` handles this transparently.

## ADR-027: UUID-based Tab Identification
- **Context**: Chrome's `tab.id` is ephemeral and reused across sessions. It cannot be used as a stable identifier for long-term storage (snoozed tabs).
- **Decision**: Generate a distinct UUID (v4-style) for every snoozed tab at the moment of snoozing.
- **Consequences**:
    - **Stable Identity**: Each snoozed item has a permanent unique ID.
    - **Safe Restore**: We don't rely on browser internal IDs.
    - **Idempotency**: Operations like "Remove Item" are safe and exact, even if the user has multiple tabs with the same URL.

## ADR-028: Centralized Chrome API Wrapper
- **Context**: Direct `chrome.*` API calls were scattered across 7+ files with inconsistent error handling, mixing callback and Promise patterns, and lacking a centralized abstraction for testing and Firefox compatibility.
- **Decision**: Implement `src/utils/ChromeApi.js` as a unified wrapper for all Chrome Extension APIs:
    - **Wrapped APIs**: storage (local/session), tabs, windows, notifications, alarms, runtime, commands
    - **Promise-based**: Convert all callback-based APIs (commands.getAll, runtime.openOptionsPage) to Promises for async/await support
    - **Error Handling**: Consistent try-catch patterns with descriptive error messages
    - **Firefox Compatibility**: Graceful fallbacks for unsupported APIs (session storage, getBytesInUse)
    - **Event Listeners Excluded**: Keep direct calls for chrome.runtime.onInstalled, chrome.alarms.onAlarm, etc., as they're one-time registrations
- **Consequences**:
    - **Consistency**: All Chrome API interactions go through a single abstraction layer
    - **Testability**: Centralized mocking point for all Chrome API interactions in tests
    - **Error Handling**: Uniform error handling and logging across the codebase
    - **Maintainability**: Easier to add retry logic, rate limiting, or API pattern updates in one place
    - **Code Quality**: Reduced code duplication and improved readability with consistent async/await patterns

## ADR-029: Restoration Failure Handling (Retry & Dialog) [Planned]
- **Context**: Only relying on "Leave in storage" for failed tabs caused infinite loops where the system tried to restore the same broken tab every minute.
- **Decision**: Implement an immediate retry loop (3x with 200ms delay) followed by a user-facing Error Dialog.
    - **Quarantine Rejected**: We considered a separate "quarantine" list but decided it was too complex. Keeping it simple: Retry -> Fail -> Notify User Immediately.
- **Consequences**:
    - **Robustness**: Transient errors (network/CPU spikes) are handled silently by retries.
    - **User Agency**: Permanent errors (invalid URLs) block the loop and demand user attention via a Dialog.
