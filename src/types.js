/**
 * Type Definitions for Snooooze Extension
 *
 * This file contains JSDoc type definitions for all core data structures.
 * Import these types in other files using:
 * @typedef {import('./types.js').TypeName} TypeName
 */

/**
 * Individual snoozed tab item in V2 normalized storage schema
 * @typedef {Object} SnoozedItemV2
 * @property {string} id - Unique UUID identifier
 * @property {string} url - Tab URL
 * @property {string} [title] - Tab title (optional)
 * @property {string|null} [favicon] - Favicon URL (optional, can be null)
 * @property {number} creationTime - Creation timestamp (milliseconds since epoch)
 * @property {number} popTime - Scheduled wake time (milliseconds since epoch)
 * @property {string|null} [groupId] - Window group UUID (null for individual tabs)
 * @property {number} [index] - Original tab index
 */

/**
 * V2 normalized storage root structure
 * @typedef {Object} StorageV2
 * @property {number} version - Schema version (always 2 for current schema)
 * @property {Record<string, SnoozedItemV2>} items - Map of UUID to SnoozedItemV2
 * @property {Record<string, string[]>} schedule - Map of popTime (as string) to array of item UUIDs
 */

/**
 * Extension settings object
 * @typedef {Object} Settings
 * @property {string} 'start-day' - Morning time (format: "H:MM AM/PM", e.g., "8:00 AM")
 * @property {string} 'end-day' - Evening time (format: "H:MM AM/PM", e.g., "5:00 PM")
 * @property {number} 'week-begin' - First day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @property {number} 'weekend-begin' - First day of weekend (0-6, typically 6=Saturday)
 * @property {string} [timezone] - IANA timezone identifier (e.g., "America/New_York")
 * @property {Record<string, string[]>} [shortcuts] - Custom keyboard shortcuts map
 * @property {"default"|"vivid"|"heatmap"} [appearance] - Color scheme
 */

/**
 * Validation result returned by validation utilities
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the data is valid
 * @property {string[]} errors - Array of error messages
 */

/**
 * Storage recovery result from backup system
 * @typedef {Object} RecoveryResult
 * @property {boolean} recovered - Whether recovery succeeded
 * @property {number} tabCount - Number of tabs recovered
 * @property {boolean} [sanitized] - Whether sanitized backup was used (if primary backup invalid)
 */

/**
 * Chrome tab object (subset of chrome.tabs.Tab)
 * @typedef {Object} ChromeTab
 * @property {number} id - Chrome tab ID
 * @property {string} url - Tab URL
 * @property {string} title - Tab title
 * @property {string} [favIconUrl] - Favicon URL (optional)
 * @property {number} index - Tab index in window
 */

/**
 * Chrome notification options
 * @typedef {Object} NotificationOptions
 * @property {"basic"|"image"|"list"|"progress"} type - Notification type
 * @property {string} iconUrl - Notification icon URL
 * @property {string} title - Notification title
 * @property {string} message - Notification message
 * @property {number} [priority] - Priority level (0-2)
 */

/**
 * Display item for Popup UI (snooze action button)
 * @typedef {Object} DisplayItem
 * @property {string} id - Action identifier (e.g., "later-today", "tomorrow-morning")
 * @property {string} label - Display label
 * @property {import('lucide-react').LucideIcon} icon - Lucide icon component
 * @property {string[]} shortcuts - Keyboard shortcut keys
 * @property {string} color - Tailwind color class
 */

/**
 * Snoozed item display format for Options UI
 * @typedef {Object} SnoozedTabDisplay
 * @property {"tab"} type - Item type (individual tab)
 * @property {SnoozedItemV2} data - Tab data
 * @property {number} popTime - Scheduled wake time
 */

/**
 * Snoozed window group display format for Options UI
 * @typedef {Object} SnoozedGroupDisplay
 * @property {"group"} type - Item type (window group)
 * @property {string} groupId - Window group UUID
 * @property {SnoozedItemV2[]} groupItems - Array of tabs in group
 * @property {number} popTime - Scheduled wake time for entire group
 */

/**
 * Union type for snoozed display items
 * @typedef {SnoozedTabDisplay | SnoozedGroupDisplay} SnoozedDisplay
 */

// ============================================================================
// Message Passing Contracts
// ============================================================================

/**
 * Request: Get all snoozed tabs (V2 format)
 * @typedef {Object} GetSnoozedTabsV2Request
 * @property {"getSnoozedTabsV2"} action
 */

/**
 * Request: Set snoozed tabs (overwrite, V1/V2 auto-detected and migrated)
 * @typedef {Object} SetSnoozedTabsRequest
 * @property {"setSnoozedTabs"} action
 * @property {Object} data - V1 legacy format or V2 data (auto-detected and migrated)
 */

/**
 * Request: Import tabs (V1/V2 format, merged with existing)
 * @typedef {Object} ImportTabsRequest
 * @property {"importTabs"} action
 * @property {Object} data - V1 legacy format or V2 data (auto-detected and migrated)
 */

/**
 * Response: Import result
 * @typedef {Object} ImportTabsResponse
 * @property {boolean} success - Whether import succeeded
 * @property {number} [addedCount] - Number of tabs added
 * @property {string} [error] - Error message if failed
 */

/**
 * Request: Export tabs
 * @typedef {Object} ExportTabsRequest
 * @property {"exportTabs"} action
 */

/**
 * Request: Get extension settings
 * @typedef {Object} GetSettingsRequest
 * @property {"getSettings"} action
 */

/**
 * Request: Update extension settings
 * @typedef {Object} SetSettingsRequest
 * @property {"setSettings"} action
 * @property {Partial<Settings>} data - Settings to update
 */

/**
 * Request: Snooze a tab
 * @typedef {Object} SnoozeRequest
 * @property {"snooze"} action
 * @property {ChromeTab} tab - Tab to snooze
 * @property {number} popTime - Scheduled wake timestamp
 * @property {string} [groupId] - Optional window group UUID
 */

/**
 * Request: Remove a snoozed tab
 * @typedef {Object} RemoveSnoozedTabRequest
 * @property {"removeSnoozedTab"} action
 * @property {SnoozedItemV2} tab - Tab to remove
 */

/**
 * Request: Remove entire window group
 * @typedef {Object} RemoveWindowGroupRequest
 * @property {"removeWindowGroup"} action
 * @property {string} groupId - Window group UUID
 */

/**
 * Request: Restore entire window group
 * @typedef {Object} RestoreWindowGroupRequest
 * @property {"restoreWindowGroup"} action
 * @property {string} groupId - Window group UUID
 */

/**
 * Request: Clear all snoozed tabs
 * @typedef {Object} ClearAllSnoozedTabsRequest
 * @property {"clearAllSnoozedTabs"} action
 */

/**
 * Union type for all message requests
 * @typedef {GetSnoozedTabsV2Request | SetSnoozedTabsRequest | GetSettingsRequest |
 *           SetSettingsRequest | SnoozeRequest | RemoveSnoozedTabRequest |
 *           RemoveWindowGroupRequest | RestoreWindowGroupRequest |
 *           ClearAllSnoozedTabsRequest | ImportTabsRequest | ExportTabsRequest} MessageRequest
 */

/**
 * Standard success response
 * @typedef {Object} SuccessResponse
 * @property {boolean} success - Operation success status
 */

/**
 * Error response returned when message handling fails
 * @typedef {Object} ErrorResponse
 * @property {string} error - Error message describing what went wrong
 */

/**
 * Union type for all message responses
 * @typedef {StorageV2 | Settings | SuccessResponse | ErrorResponse | ImportTabsResponse} MessageResponse
 */
