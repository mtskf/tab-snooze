/**
 * Type Definitions for Snooooze Extension
 */

import type { LucideIcon } from 'lucide-react';

// ============================================================================
// Core Data Structures
// ============================================================================

/**
 * Individual snoozed tab item in V2 normalized storage schema
 */
export interface SnoozedItemV2 {
  /** Unique UUID identifier */
  id: string;
  /** Tab URL */
  url: string;
  /** Tab title (optional) */
  title?: string;
  /** Favicon URL (optional, can be null) */
  favicon?: string | null;
  /** Creation timestamp (milliseconds since epoch) */
  creationTime: number;
  /** Scheduled wake time (milliseconds since epoch) */
  popTime: number;
  /** Window group UUID (null for individual tabs) */
  groupId?: string | null;
  /** Original tab index */
  index?: number;
}

/**
 * V2 normalized storage root structure
 */
export interface StorageV2 {
  /** Schema version (always 2 for current schema) */
  version: number;
  /** Map of UUID to SnoozedItemV2 */
  items: Record<string, SnoozedItemV2>;
  /** Map of popTime (as string) to array of item UUIDs */
  schedule: Record<string, string[]>;
}

/**
 * Extension settings object
 */
export interface Settings {
  /** Morning time (format: "H:MM AM/PM", e.g., "8:00 AM") */
  'start-day': string;
  /** Evening time (format: "H:MM AM/PM", e.g., "5:00 PM") */
  'end-day': string;
  /** First day of week (0=Sunday, 1=Monday, ..., 6=Saturday) */
  'week-begin': number;
  /** First day of weekend (0-6, typically 6=Saturday) */
  'weekend-begin': number;
  /** IANA timezone identifier (e.g., "America/New_York") */
  timezone?: string;
  /** Custom keyboard shortcuts map */
  shortcuts?: Record<string, string[]>;
  /** Color scheme */
  appearance?: 'default' | 'vivid' | 'heatmap';
}

/**
 * Validation result returned by validation utilities
 */
export interface ValidationResult {
  /** Whether the data is valid */
  valid: boolean;
  /** Array of error messages */
  errors: string[];
}

/**
 * Storage recovery result from backup system
 */
export interface RecoveryResult {
  /** Whether recovery succeeded */
  recovered: boolean;
  /** Number of tabs recovered */
  tabCount: number;
  /** Whether sanitized backup was used (if primary backup invalid) */
  sanitized?: boolean;
}

/**
 * Chrome tab object (subset of chrome.tabs.Tab)
 */
export interface ChromeTab {
  /** Chrome tab ID */
  id: number;
  /** Tab URL */
  url: string;
  /** Tab title */
  title: string;
  /** Favicon URL (optional) */
  favIconUrl?: string;
  /** Tab index in window */
  index: number;
}

/**
 * Chrome notification options
 */
export interface NotificationOptions {
  /** Notification type */
  type: 'basic' | 'image' | 'list' | 'progress';
  /** Notification icon URL */
  iconUrl: string;
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Priority level (0-2) */
  priority?: number;
}

/**
 * Display item for Popup UI (snooze action button)
 */
export interface DisplayItem {
  /** Action identifier (e.g., "later-today", "tomorrow-morning") */
  id: string;
  /** Display label */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Keyboard shortcut keys */
  shortcuts: string[];
  /** Tailwind color class */
  color: string;
}

/**
 * Snoozed item display format for Options UI
 */
export interface SnoozedTabDisplay {
  /** Item type (individual tab) */
  type: 'tab';
  /** Tab data */
  data: SnoozedItemV2;
  /** Scheduled wake time */
  popTime: number;
}

/**
 * Snoozed window group display format for Options UI
 */
export interface SnoozedGroupDisplay {
  /** Item type (window group) */
  type: 'group';
  /** Window group UUID */
  groupId: string;
  /** Array of tabs in group */
  groupItems: SnoozedItemV2[];
  /** Scheduled wake time for entire group */
  popTime: number;
}

/**
 * Union type for snoozed display items
 */
export type SnoozedDisplay = SnoozedTabDisplay | SnoozedGroupDisplay;

// ============================================================================
// Message Passing Contracts
// ============================================================================

/**
 * Request: Get all snoozed tabs (V2 format)
 */
export interface GetSnoozedTabsV2Request {
  action: 'getSnoozedTabsV2';
}

/**
 * Request: Set snoozed tabs (overwrite, V1/V2 auto-detected and migrated)
 */
export interface SetSnoozedTabsRequest {
  action: 'setSnoozedTabs';
  /** V1 legacy format or V2 data (auto-detected and migrated) */
  data: unknown;
}

/**
 * Request: Import tabs (V1/V2 format, merged with existing)
 */
export interface ImportTabsRequest {
  action: 'importTabs';
  /** V1 legacy format or V2 data (auto-detected and migrated) */
  data: unknown;
}

/**
 * Response: Import result
 */
export interface ImportTabsResponse {
  /** Whether import succeeded */
  success: boolean;
  /** Number of tabs added */
  addedCount?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Request: Export tabs
 */
export interface ExportTabsRequest {
  action: 'exportTabs';
}

/**
 * Request: Get extension settings
 */
export interface GetSettingsRequest {
  action: 'getSettings';
}

/**
 * Request: Update extension settings
 */
export interface SetSettingsRequest {
  action: 'setSettings';
  /** Settings to update */
  data: Partial<Settings>;
}

/**
 * Request: Snooze a tab
 */
export interface SnoozeRequest {
  action: 'snooze';
  /** Tab to snooze */
  tab: ChromeTab;
  /** Scheduled wake timestamp */
  popTime: number;
  /** Optional window group UUID */
  groupId?: string;
}

/**
 * Request: Remove a snoozed tab
 */
export interface RemoveSnoozedTabRequest {
  action: 'removeSnoozedTab';
  /** Tab to remove */
  tab: SnoozedItemV2;
}

/**
 * Request: Remove entire window group
 */
export interface RemoveWindowGroupRequest {
  action: 'removeWindowGroup';
  /** Window group UUID */
  groupId: string;
}

/**
 * Request: Restore entire window group
 */
export interface RestoreWindowGroupRequest {
  action: 'restoreWindowGroup';
  /** Window group UUID */
  groupId: string;
}

/**
 * Request: Clear all snoozed tabs
 */
export interface ClearAllSnoozedTabsRequest {
  action: 'clearAllSnoozedTabs';
}

/**
 * Union type for all message requests
 */
export type MessageRequest =
  | GetSnoozedTabsV2Request
  | SetSnoozedTabsRequest
  | GetSettingsRequest
  | SetSettingsRequest
  | SnoozeRequest
  | RemoveSnoozedTabRequest
  | RemoveWindowGroupRequest
  | RestoreWindowGroupRequest
  | ClearAllSnoozedTabsRequest
  | ImportTabsRequest
  | ExportTabsRequest;

/**
 * Standard success response
 */
export interface SuccessResponse {
  /** Operation success status */
  success: boolean;
}

/**
 * Error response returned when message handling fails
 */
export interface ErrorResponse {
  /** Error message describing what went wrong */
  error: string;
}

/**
 * Union type for all message responses
 */
export type MessageResponse =
  | StorageV2
  | Settings
  | SuccessResponse
  | ErrorResponse
  | ImportTabsResponse;
