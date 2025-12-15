# Changelog

All notable changes to this project will be documented in this file.

## [v0.3.0] - Unreleased

### Added
- **Timezone Support**: Added a "Timezone" setting in Options. Snooze times now correctly respect the selected or detected timezone.
- **Clear All Icon**: Added a trash icon to the "Clear All" button in the Snoozed Tabs list.

### Changed
- **Restoration Logic**: "Open in New Tab" setting now globally determines if tabs open in the current window or a new window, simplifying behavior.
- **Window Snoozing**: Reverted window grouping in the UI. Snoozed windows now appear as individual tabs in the list but can still be snoozed as a batch.
- **UI Refresh**: Major UI updates using Shadcn/ui components for a cleaner look.
- **Renaming**: Renamed "Snoozed Tabs" section to "Snoozed".

### Removed
- **Badge Count**: Removed the unread badge count from the extension icon.

### Fixed
- **Race Condition**: Fixed a bug where snoozing multiple tabs simultaneously (e.g., a full window) caused data loss. Implemented mutex lock for storage.
