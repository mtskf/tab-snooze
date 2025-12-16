# Changelog

All notable changes to this project will be documented in this file.

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
