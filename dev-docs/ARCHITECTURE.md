# Architecture

> Implementation details (structure, algorithms, file organization)

Chrome Extension (Manifest V3) - Snooze tabs and restore at scheduled time

## Stack

- Runtime: Service Worker (no DOM API)
- UI: React 18 + TypeScript
- Styling: Tailwind CSS + shadcn/ui
- Build: Vite
- Storage: chrome.storage.local + chrome.storage.session (for failed tabs)
- Testing: Vitest

## Data Model

### `snoooze_v2`

```typescript
interface StorageV2 {
  version: 2;
  items: Record<string, SnoozedItemV2>;   // UUID → Item
  schedule: Record<string, string[]>;      // timestamp → [UUID, ...]
}

interface SnoozedItemV2 {
  id: string;                              // UUID
  url: string;
  title?: string;
  favicon?: string | null;
  popTime: number;                         // Restore timestamp (ms)
  creationTime: number;
  groupId?: string | null;                 // Window group UUID
  index?: number;
}
```

### Settings

```typescript
interface Settings {
  "start-day": string;                     // "8:00 AM"
  "end-day": string;                       // "5:00 PM"
  "week-begin": number;                    // 0=Sunday, 6=Saturday
  "weekend-begin": number;                 // 0-6
  timezone?: string;                       // IANA timezone
  shortcuts?: Record<string, string[]>;
  appearance?: 'default' | 'vivid' | 'heatmap';
}
```

## Core Flows

(Terminology: see SPEC.md § Terminology)

### Snooze

1. Calculate `popTime` (timeUtils.ts)
2. Validate URL (exclude RESTRICTED_PROTOCOLS)
3. Generate UUID, save to storage
4. **After save succeeds** → close tab

**Safety**: Tabs NEVER closed before storage write succeeds.

### Restore

1. Alarm fires every 1min + on install/startup
2. Skip if offline or already restoring
3. Find due items (`popTime < now`, strict <)
4. **Group by `groupId`**:
   - Grouped tabs → open new window with all URLs together
   - Ungrouped tabs → add to last-focused window (create new if unavailable)
5. **Retry**: 3x per tab/group (200ms intervals)
6. **Success** → remove from storage
7. **Failure** (after 3 retries):
   - Save to session storage (`failedRestoreTabs`)
   - Reschedule +5min (update popTime in storage)
   - Show notification with click → Options dialog
   - Existing 1-min alarm will detect rescheduled items

### Backup & Recovery

**Backup**:

- Auto-save on write (debounced 2s)
- Rotate: keep 3 latest backups
- Validates before backup (skip if invalid)

**Recovery** (3-tier):

1. **Fully valid** backup (passes `validateSnoozedTabsV2`)
2. **Best sanitized** backup (most items after sanitization)
3. **Empty reset** (no recoverable data)

**Trigger**: On startup if V2 validation fails

- Queue `pendingRecoveryNotification` with tab count
- Recovery notification: 5-min cooldown
- Storage warning notification: 24-hour cooldown (separate)

### Migration & Import

**V1→V2**: `ensureValidStorage` sanitizes, preserves valid entries

**Import**:

- Reject future schema versions (> current version)
- Regenerate UUIDs on collision
- Validation + repair mode
- Merge with existing data (no overwrite)

## Concurrency Control

### Storage Mutex (Promise Chain)

Used for: snooze, restore, import, manual remove

```typescript
let storageLock = Promise.resolve();

const task = storageLock.then(async () => {
  const data = await getStorageV2();
  // modify...
  await saveStorageV2(data);
});
storageLock = task.catch(() => {});
await task;
```

### Backup Debounce (Separate Timer)

- Scheduled after storage write succeeds
- Debounced 2 seconds (avoid rapid cascading)
- Runs outside storageLock (non-blocking)

### Restore State Lock (Flag)

- `isRestoring` boolean prevents concurrent restore
- Set at start of popCheck(), cleared in finally

## Key Files

```
src/
├── background/
│   ├── serviceWorker.ts      # onInstalled, onStartup, alarm
│   ├── snoozeLogic.ts        # Core logic, mutex
│   └── schemaVersioning.ts   # V1→V2, sanitize
├── popup/Popup.tsx           # Snooze UI
├── options/Options.tsx       # Settings, list
├── utils/
│   ├── ChromeApi.ts          # Promise-based wrappers
│   ├── timeUtils.ts          # Time calculations
│   ├── validation.ts         # isRestorableUrl
│   └── StorageService.ts     # Import/export
├── messages.ts               # IPC contract
└── types.ts                  # Interfaces
```

## Critical Constraints

- **No DOM API** in Service Worker
- **Storage quota**: 10MB limit, warn at 8MB (80% threshold); Firefox: disabled (`getBytesInUse` unsupported)
- **URL validation**: Must exclude RESTRICTED_PROTOCOLS
- **Tab close safety**: Always save first
- **Restore retry**: 3x before reschedule
