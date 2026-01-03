# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

*No unreleased changes*

## v0.2.7

### Added
- **Storage Size Warning**: Warn users when storage usage approaches the 10MB limit.
  - Notification at 80% usage with 24-hour throttle
  - Hysteresis (80%/70%) to prevent repeated warnings
  - In-app Alert banner in Options page
  - Click notification to open Options
  - Firefox graceful fallback (feature disabled silently)


## v0.2.6

### Added
- **Auto Backup Fallback**: Automatic backup and recovery for snoozed tabs storage.
  - 3-generation rotating backups with 2-second debounce
  - Validates data on read and recovers from backup if corrupted
  - Migration creates initial backup for existing users
  - Recovery notification with 5-minute deduplication
- **Validation Utility**: New `src/utils/validation.js` for data integrity checks.

## v0.2.5

### Fixed
- **Service Worker**: Inlined `DEFAULT_SETTINGS` to prevent Vite code-splitting, which caused "Cannot use import statement outside a module" error.

## v0.2.4

### Changed
- **Default Settings**: Updated to 8:00 AM / 5:00 PM (previously 9:00 AM / 6:00 PM).
- **Centralized Config**: Moved `DEFAULT_SETTINGS` to `constants.js` (shared by `snoozeLogic.js` and `timeUtils.js`).
- **Code Quality**: Replaced all `var` with `const`/`let` in `snoozeLogic.js`.

### Removed
- **Unused Setting**: Removed vestigial "Later Today" time setting key (was unused, defaulted to +1 hour).

### Refactored
- **Helper Function**: Extracted `getTabsByGroupId()` to reduce code duplication.
- **Synchronous Fix**: Removed incorrect `async` from `removeSnoozedTab()` (it was synchronous).
- **Comments**: Fixed duplicate comment numbering and added clarifying comments for mutex pattern.

## [v0.2.3] - 2025-12-27

### Added
- **Refactoring**: Consolidated storage helper functions in `snoozeLogic.js` (exported and shared with `serviceWorker.js`).
- **Tests**: Added `storageHelpers.test.js` with 5 new tests for storage functions.
- **Dynamic Labels**: "Tomorrow" becomes "This morning" (early hours) and "This weekend" becomes "Next weekend" (during weekend).

### Changed
- **DatePicker**: Calendar now starts on Monday (`weekStartsOn=1`).
- **Scope Preservation**: Shift+P now correctly preserves window scope when snoozing via DatePicker (`calendarScope` state).
- **Package Manager**: Migrated from `npm` to `pnpm`.
- **Timezone**: Automates timezone detection using `Intl.DateTimeFormat`, removed manual selection UI.
- **Default Times**: Changed default `start-day` to 8:00 AM (was 9:00 AM) and `end-day` to 5:00 PM (was 6:00 PM).
- **Pick Date**: Now defaults to `start-day` time instead of hardcoded 9:00 AM.
- **This Weekend**: Now uses `start-day` time instead of separate `start-weekend` time.

### Removed
- **Unused Code**: Removed `storage.js` (dead code).
- **Unused Time Keys**: Removed internal time options (`next-week`, `next-month`, `day-after-tomorrow`, `2-days-morning`, `2-days-evening`, `someday`) from `timeUtils.js`.
- **Debug Code**: Removed `console.log` statements and duplicate `setBadgeBackgroundColor` call.
- **Delete Confirmation**: Removed confirmation dialog for single window group deletion.
- **Tomorrow Evening**: Removed "Tomorrow Evening" option to simplify choices.

## [v0.2.2] - 2025-12-22

### Added
- **Appearance Settings**: Visual theme selection (Default, Vivid, Warm Heatmap).
- **Dynamic Theming**: UI colors now reflect the selected theme.
- **Global Shortcut UI**: View/configure global extension shortcut in Options.
- **Refactoring**: Split `Options.jsx` into smaller components.

### Changed
- **Options Layout**: Fixed panel width to prevent layout shifts.

## [v0.1.0] - 2025-12-16

### Added
- **Landing Page**: New "How to Use" section, mobile optimizations, and Intercom integration.
- **Website Link**: Added link to official GitHub Pages site in README and Options.
- **Mobile Optimization**: Improved Hero section layout for small screens (<480px).

### Changed
- **Version**: Bumped to v0.1.0 Beta for Chrome Web Store release.
- **Footer**: Refined copyright text size on landing page.
- **Timezone Combobox**: Replaced dropdown with searchable city selection (e.g., "New York", "Tokyo").
- **DST Support**: Integrated `date-fns-tz` for accurate Daylight Saving Time calculations and display.
- **Dynamic Offsets**: Timezone list now maps current GMT offsets (e.g., `(GMT +9:00)`).
- **Export/Import**: Export and import snoozed tabs in OneTab-compatible format (`URL | Title`).
- **Shift+Shortcut**: Hold Shift while pressing shortcuts to snooze entire window instead of selected tabs.
- **Snoozed Button**: Added "Snoozed" button to Popup header with count badge (displays 999+ for large counts).
- **Overdue Restoration**: Tabs past their scheduled snooze time are now restored immediately on browser startup.

### Changed
- **Settings Layout**: Morning, Evening, and Timezone settings are now on a single row.
- **Popup Scope UI**: Reduced button size, added "Default" / "Hold Shift" labels under scope selection.
- **Popup Title**: Changed to "Snooooze" with playful branding.
- **Settings Button**: Now opens directly to the Settings tab (using URL hash).
- **UI Refresh**: Applied "Neo Carbon" dark theme for modern aesthetic.
- **SelectLabel Styling**: Darkened timezone group labels for better visual hierarchy.

### Removed
- **Badge Count**: Removed unread badge count from extension icon.
- **Radio Indicators**: Visually hidden radio buttons in scope selection (functionality preserved).

### Fixed
- **Race Condition**: Fixed data loss when snoozing multiple tabs simultaneously.
### Added
- **Direct Restoration**: Tabs now restore automatically without notifications.
- **Manual Check (Dev)**: Added (and later removed) debug tools for restoration testing.

### Changed
- **Shortcuts**: Reverted default shortcut to `Command + Period` (Mac) / `Ctrl + Period` (Win/Linux).
- **Export/Import**: Reverted buttons to `Secondary` style.
- **Options Layout**: Restored horizontal layout for Data Management buttons.

### Removed
- **Notifications**: Removed notification-based restoration logic.
- **OneTab Support**: Export/Import now uses JSON format to preserve timestamps.
- **Debug UI**: Removed "Check Now" button.
### Added
- **Snoozed Search**: Added real-time search filtering for snoozed tabs with space/comma-delimited multi-keyword support.
- **Pick Date Shortcut**: Added "Pick Date" to configurable keyboard shortcuts in Settings.

### Changed
- **Hotkeys**: Simplified from dual (number+letter) to single letter shortcuts (L, E, T, S, N, W, M, P).
- **Calendar UI**: Replaced Popover with a custom modal overlay for better visibility and focus management.
- **Calendar Logic**: Implemented `captionLayout="dropdown-buttons"` with a custom Shadcn-compatible Dropdown component for intuitive year/month navigation.
- **Calendar Escape**: Pressing Escape now closes only the calendar, not the entire popup.
- **Options Layout**: Refined "Snooze Timing" into "Start Day" and "End Day" rows, and aligned "Keyboard Shortcuts" for consistent UI flow.
- **ShortcutEditor**: Added icons with colors matching Popup styling to the Keyboard Shortcuts section.
