# Architecture Decision Records

Documents significant architectural decisions made during development.

## ADR-001: Revert Window Grouping
- **Context**: We initially implemented a feature to group snoozed tabs by their original "Window" in the Options UI.
- **Decision**: We reverted this change.
- **Consequences**: Snoozed tabs are stored and displayed individually. This simplifies the restoration logic and gives users more granular control over individual tabs, while still allowing them to snooze a whole window at once (creates multiple individual snooze entries).

## ADR-002: Global Restoration Context
- **Context**: Tabs could be restored in "Current Window" or "New Window". Originally this was partly dependent on whether they were snoozed as a window.
- **Decision**: The "Open in New Tab" setting in Options now globally dictates the restoration target.
    - If ON: All tabs restore in the *Current Window* (as new tabs).
    - If OFF: All tabs restore in a *New Window*.
- **Consequences**: Behavior is predictable and user-configurable globally, rather than context-dependent.

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

## ADR-015: Badge Text Updates
- **Context**: The badge count was stored in `tabCount` but never displayed on the extension icon. Users had no quick visual indicator of pending snoozed tabs.
- **Decision**: Implement `updateBadge()` in `snoozeLogic.js` that reads settings and tab count, then calls `chrome.action.setBadgeText`.
    - Called automatically from `setSnoozedTabs` and `setSettings`.
    - Respects `settings.badge === "false"` to hide the badge if user prefers.
- **Consequences**: Badge is always in sync with storage. Adding a new message handler `updateBadgeText` was unnecessary but harmless (forwards to the same function).

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
