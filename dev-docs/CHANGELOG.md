# Changelog

All notable changes to this project will be documented in this file.

## v0.3.0 - 2026-01-04

### Refactored
- **Codebase Deep Review**: Comprehensive review and cleanup of `snoozeLogic.js`, `messages.js`, and `ChromeApi.js`.
- **Error Handling**: Enhanced `timeUtils.js` to gracefully fallback to defaults when storage access fails.
- **Chrome API**: Fully integrated `ChromeApi` wrapper across all logic and UI components, replacing direct `chrome.*` calls for better stability and testability.
- **Type Definitions**: Consolidated `types.js` to import and use shared types throughout the app.

### Fixed
- **Settings Fallback**: Fixed potential crash in `getTime` when `getSettings` fails by adding robust error handling.



### Added
- **Message Passing Contracts**: New `src/messages.js` centralizes all message passing with `MESSAGE_ACTIONS` constants, `validateMessageRequest()`, `MESSAGE_HANDLERS` registry with dependency injection, and promise-based `sendMessage()` helper. Prevents typos, enables IDE autocomplete, and improves testability.
- **Chrome API Wrapper**: New `src/utils/ChromeApi.js` provides unified abstraction layer for all chrome.* APIs (storage, tabs, windows, notifications, alarms, runtime, commands) with consistent error handling, Firefox compatibility (graceful fallbacks for session storage and getBytesInUse), promise-based interfaces for async/await support, and callback-to-Promise conversion for legacy APIs (commands.getAll, runtime.openOptionsPage).
- **Schema Versioning**: Implemented schema versioning system with `version` field in V2 storage structure, migration registry (`SCHEMA_MIGRATIONS`), and unified entry point (`ensureValidStorage()`) for validation, migration, and repair.
- **StorageService**: New `src/utils/StorageService.js` to centralize import/export parsing, validation, and merge behavior, with dedicated tests.
- **JSDoc Type Definitions**: Added comprehensive JSDoc type definitions in `src/types.js` for core data structures (`SnoozedItemV2`, `StorageV2`, `Settings`, `ValidationResult`, etc.) and message passing contracts, with type annotations added to `snoozeLogic.js`, `validation.js`, and `schemaVersioning.js`.

### Fixed
- **Error Handling in timeUtils**: `getTime()` now handles `getSettings()` failures gracefully with try-catch, falling back to `DEFAULT_SETTINGS` and system timezone when chrome.storage API is unavailable. Prevents crashes in test environments or during API failures.
- **Defensive Storage Access**: `getStorageV2` now validates structure and ensures `items`/`schedule` are always valid objects, preventing crashes when storage is corrupted or partially missing.
- **Unified Default Fallbacks**: Replaced hardcoded fallback values (`9` in `timeUtils.getSettingsTime`, `8` in `Popup.parseTimeHour`) with `DEFAULT_SETTINGS`-derived values via new shared `parseTimeString` utility.
- **Array Detection in Schema Versioning**: `detectSchemaVersion` now correctly rejects array inputs (returns `null`), preventing arrays from being misidentified as V1 legacy data.
- **Version Field Preservation**: `getValidatedSnoozedTabs` and `recoverFromBackup` now add `version: 2` field when saving sanitized data, ensuring consistent schema versioning after repair operations.

### Changed
- **Chrome API Migration**: Migrated all direct `chrome.*` API calls across 7 files to use `ChromeApi` wrappers (snoozeLogic.js, serviceWorker.js, schemaVersioning.js, Options.jsx, GlobalShortcutSettings.jsx, useKeyboardNavigation.js, Popup.jsx). Event listeners preserved as direct calls. Added comprehensive error handling with `.catch()` handlers on all Promise-based wrapper calls in UI components.
- **Debug Command**: Limited `jjj` debug command (1-minute snooze) to development builds only via `import.meta.env.DEV` check.
- **Options Import/Export**: Options page now delegates import/export to `StorageService`, simplifying UI logic and ensuring consistent validation/sanitization.
- **Popup Settings Fetch**: Popup now requests settings via background messaging instead of direct storage reads.
- **Import Merge Source**: Import merges against background `getSnoozedTabs` data to avoid overwriting V2 state.
- **Startup Recovery**: Invalid `snoooze_v2` triggers backup recovery and queues a pending notification on startup.

## v0.2.8

### Added
- **Safety Tests**: Added `snoozeLogic.safety.test.js` covering storage persistence order, failure recovery, and restoration safety.
- **Import Repair**: Added ability to "Sanitize & Import" partially valid backup files (e.g., mismatched tab counts).
- **UUIDs**: Implemented UUID-based tab identification for robust restoration and deduplication.

### Changed
- **Safe Snooze**: Changed operations order to save to storage *before* closing tabs. Ensures no data loss if storage write fails.
- **Restoration Safety**: `popCheck` now tracks success per-tab. Only successfully restored tabs are removed from storage; failed tabs (e.g., invalid URLs) are preserved.
- **Documentation**: Comprehensive updates to ADRs, Architecture, and Specs.
- **Landing Page SEO**: Added `rel="noopener noreferrer"` to all external links, enhanced `og:image`/`twitter:image` meta tags, and added canonical link.

### Removed
- **Badge Feature**: Completely removed the experimental badge count (`updateBadge`) to simplify architecture and avoid unnecessary background wake-ups.
- **Open in New Tab**: Removed the `openInNewWindow` setting. Restoration behavior is now strictly determined by the Snooze Scope (Selected Tabs vs. Window).

### Refactored
- **Storage V2**: Completely overhauled storage architecture from time-based arrays to a normalized relational model (`items` map + `schedule` index).
  - Use of UUIDs for all tabs allows robust deduplication and ID-based operations.
  - Automatic migration from legacy schema on startup.
  - Includes backward-compatibility adapter for UI components.
  - Significantly improved data integrity and safety.

### Fixed
- **Bundle Loading**: Configured `"type": "module"` in `manifest.json` to correctly support split chunks (e.g., shared validation logic) in the background service worker, preventing potential loading failures.
- **Restoration Race**: Fixed race condition in `restoreTabs` by properly chaining storage cleanup to the mutex `storageLock`.
- **Storage Lock**: Fixed critical bug where a storage write failure could leave the mutex lock (`storageLock`) in a rejected state, blocking all future operations.
- **Config**: Fixed duplicate `weekend-begin` key in default settings.
- **Critical: Storage Null Checks**: `addSnoozedTab`, `removeSnoozedTabWrapper`, `restoreWindowGroup`, and `removeWindowGroup` now safely handle missing or corrupted storage.
- **Search Filter**: Added `Array.isArray` check in Options page search filter to prevent crashes from malformed storage data.
- **Calendar Keyboard**: Global shortcuts are now correctly disabled when the calendar picker is open.

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

## v0.2.3 - 2025-12-27

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

## v0.2.2 - 2025-12-22

### Added
- **Appearance Settings**: Visual theme selection (Default, Vivid, Warm Heatmap).
- **Dynamic Theming**: UI colors now reflect the selected theme.
- **Global Shortcut UI**: View/configure global extension shortcut in Options.
- **Refactoring**: Split `Options.jsx` into smaller components.

### Changed
- **Options Layout**: Fixed panel width to prevent layout shifts.

## v0.1.0 - 2025-12-16

### Added
- **Landing Page**: New "How to Use" section, mobile optimizations, and Intercom integration.
- **Website Link**: Added link to official GitHub Pages site in README and Options.
- **Mobile Optimization**: Improved Hero section layout for small screens (<480px).
- **Direct Restoration**: Tabs now restore automatically without notifications.
- **Manual Check (Dev)**: Added (and later removed) debug tools for restoration testing.
- **Snoozed Search**: Added real-time search filtering for snoozed tabs with space/comma-delimited multi-keyword support.
- **Pick Date Shortcut**: Added "Pick Date" to configurable keyboard shortcuts in Settings.
- **Snoozed Button**: Added "Snoozed" button to Popup header with count badge (displays 999+ for large counts).
- **Shift+Shortcut**: Hold Shift while pressing shortcuts to snooze entire window instead of selected tabs.

### Changed
- **Version**: Bumped to v0.1.0 Beta for Chrome Web Store release.
- **Footer**: Refined copyright text size on landing page.
- **Timezone Combobox**: Replaced dropdown with searchable city selection (e.g., "New York", "Tokyo").
- **DST Support**: Integrated `date-fns-tz` for accurate Daylight Saving Time calculations and display.
- **Dynamic Offsets**: Timezone list now maps current GMT offsets (e.g., `(GMT +9:00)`).
- **Export/Import**: Export and import snoozed tabs in OneTab-compatible format (`URL | Title`).
- **Overdue Restoration**: Tabs past their scheduled snooze time are now restored immediately on browser startup.
- **Settings Layout**: Morning, Evening, and Timezone settings are now on a single row.
- **Popup Scope UI**: Reduced button size, added "Default" / "Hold Shift" labels under scope selection.
- **Popup Title**: Changed to "Snooooze" with playful branding.
- **Settings Button**: Now opens directly to the Settings tab (using URL hash).
- **UI Refresh**: Applied "Neo Carbon" dark theme for modern aesthetic.
- **SelectLabel Styling**: Darkened timezone group labels for better visual hierarchy.
- **Shortcuts**: Reverted default shortcut to `Command + Period` (Mac) / `Ctrl + Period` (Win/Linux).
- **Export/Import**: Reverted buttons to `Secondary` style.
- **Options Layout**: Restored horizontal layout for Data Management buttons.
- **Hotkeys**: Simplified from dual (number+letter) to single letter shortcuts (L, E, T, S, N, W, M, P).
- **Calendar UI**: Replaced Popover with a custom modal overlay for better visibility and focus management.
- **Calendar Logic**: Implemented `captionLayout="dropdown-buttons"` with a custom Shadcn-compatible Dropdown component for intuitive year/month navigation.
- **Calendar Escape**: Pressing Escape now closes only the calendar, not the entire popup.
- **Options Layout**: Refined "Snooze Timing" into "Start Day" and "End Day" rows, and aligned "Keyboard Shortcuts" for consistent UI flow.
- **ShortcutEditor**: Added icons with colors matching Popup styling to the Keyboard Shortcuts section.

### Removed
- **Badge Count**: Removed unread badge count from extension icon.
- **Radio Indicators**: Visually hidden radio buttons in scope selection (functionality preserved).
- **Notifications**: Removed notification-based restoration logic.
- **OneTab Support**: Export/Import now uses JSON format to preserve timestamps.
- **Debug UI**: Removed "Check Now" button.

### Fixed
- **Race Condition**: Fixed data loss when snoozing multiple tabs simultaneously.
