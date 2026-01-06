# Architecture Overview

## Executive Summary

**Snooooze** is a Chrome extension that lets users temporarily hide browser tabs and automatically restore them at a scheduled time.

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Snooze** | Save tab(s) to storage, close them, schedule restoration |
| **Pop** | Restore tabs when scheduled time arrives |
| **Scope** | "Selected tabs" or "Window" - determines what gets snoozed |

### Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│  ┌──────────────┐              ┌──────────────────────────────┐ │
│  │   Popup.tsx  │              │         Options.tsx          │ │
│  │  - Snooze UI │              │  - Snoozed list              │ │
│  │  - Scope     │              │  - Settings                  │ │
│  │  - Shortcuts │              │  - Import/Export             │ │
│  └──────┬───────┘              └──────────────┬───────────────┘ │
└─────────┼────────────────────────────────────┼──────────────────┘
          │ chrome.runtime.sendMessage         │
          ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE WORKER (Background)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    messages.ts                            │   │
│  │  MESSAGE_HANDLERS: dispatchMessage() → handler functions  │   │
│  └──────────────────────────────┬───────────────────────────┘   │
│                                 │                                │
│  ┌──────────────────────────────▼───────────────────────────┐   │
│  │                   snoozeLogic.ts                          │   │
│  │  - snooze()      : Save tabs, schedule alarm              │   │
│  │  - popCheck()    : Restore due tabs                       │   │
│  │  - initStorage() : Validate/recover on startup            │   │
│  └──────────────────────────────┬───────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CHROME STORAGE                               │
│  ┌─────────────────┐  ┌─────────────┐  ┌────────────────────┐   │
│  │   snoooze_v2    │  │  settings   │  │ snoozedTabs_backup │   │
│  │ (items+schedule)│  │ (user prefs)│  │  (3 generations)   │   │
│  └─────────────────┘  └─────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

- **Runtime**: Chrome Extension Manifest V3 (Service Worker)
- **UI**: React 19 + Vite 7 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Testing**: Vitest + Testing Library

---

## Data Model (V2 Schema)

### Primary Storage: `snoooze_v2`

Normalized relational model for O(1) lookups and efficient scheduling.

```typescript
interface StorageV2 {
  version: 2;
  items: Record<string, SnoozedItemV2>;   // UUID → Item
  schedule: Record<string, string[]>;      // timestamp → [UUID, ...]
}

interface SnoozedItemV2 {
  id: string;           // UUID
  url: string;          // Tab URL
  title?: string;       // Tab title
  favicon?: string;     // Favicon URL
  popTime: number;      // Restore timestamp (ms)
  creationTime: number; // Snooze timestamp (ms)
  groupId?: string;     // Window group ID (optional)
  index?: number;       // Tab position in window
}
```

**Example**:
```json
{
  "version": 2,
  "items": {
    "a1b2c3": { "id": "a1b2c3", "url": "https://example.com", "popTime": 1704110400000, "creationTime": 1704067200000 }
  },
  "schedule": {
    "1704110400000": ["a1b2c3"]
  }
}
```

### Settings Storage

```typescript
interface Settings {
  "start-day": string;      // "8:00 AM"
  "end-day": string;        // "5:00 PM"
  "timezone": string;       // "Australia/Sydney"
  "appearance": Appearance; // "heatmap" | "ocean" | ...
}
```

### Session & Backup Storage

| Key | Purpose |
|-----|---------|
| `snoozedTabs_backup_<ts>` | Rotating backups (max 3) |
| `pendingRecoveryNotification` | Session flag for recovery notification |
| `sizeWarningActive` | Storage quota warning flag |

---

## Message Contract

All UI ↔ Background communication uses typed messages via `messages.ts`.

### Message Actions

| Action | Direction | Purpose |
|--------|-----------|---------|
| `getSnoozedTabsV2` | UI → BG | Fetch all snoozed items |
| `setSnoozedTabs` | UI → BG | Import/overwrite storage |
| `getSettings` | UI → BG | Fetch user settings |
| `setSettings` | UI → BG | Update user settings |
| `snooze` | UI → BG | Snooze tab(s) |
| `removeSnoozedTab` | UI → BG | Cancel a snoozed tab |
| `removeWindowGroup` | UI → BG | Cancel entire window group |
| `restoreWindowGroup` | UI → BG | Restore window group now |
| `clearAll` | UI → BG | Delete all snoozed tabs |
| `getExportData` | UI → BG | Get data for JSON export |
| `importTabs` | UI → BG | Merge imported tabs |

### Message Flow

```
┌────────────┐   sendMessage({ action, data })   ┌────────────────┐
│   Popup    │ ─────────────────────────────────▶│ serviceWorker  │
│  Options   │                                   │                │
│            │◀───────────────────────────────── │ dispatchMessage│
└────────────┘         response                  └────────────────┘
```

---

## Key Flows

### Snooze Flow

```
User clicks "Later Today"
         │
         ▼
┌─────────────────────────────────────┐
│ 1. Popup: Calculate popTime         │
│    (timeUtils.getTime('later'))     │
└─────────────────┬───────────────────┘
                  │ sendMessage({ action: 'snooze', data: { tabs, popTime } })
                  ▼
┌─────────────────────────────────────┐
│ 2. snoozeLogic.snooze()             │
│    - Validate URL (no chrome://)    │
│    - Generate UUID                  │
│    - Add to items + schedule        │
│    - Save to storage                │
│    - Create/update alarm            │
└─────────────────┬───────────────────┘
                  │ storage.local.set() SUCCESS
                  ▼
┌─────────────────────────────────────┐
│ 3. Close tab(s)                     │
│    chrome.tabs.remove()             │
│    (ONLY after save succeeds)       │
└─────────────────────────────────────┘
```

**Critical Safety**: Tab is NEVER closed before storage save completes.

### Pop/Restore Flow

```
chrome.alarms.onAlarm fires (every 1 min)
         │
         ▼
┌─────────────────────────────────────┐
│ 1. popCheck()                       │
│    - Check navigator.onLine         │
│    - Load snoooze_v2                │
│    - Find due items (popTime < now) │
└─────────────────┬───────────────────┘
                  │ has due items?
                  ▼
┌─────────────────────────────────────┐
│ 2. Restore tabs                     │
│    - Group by groupId               │
│    - Create window or tabs          │
│    - Retry on failure (3x)          │
└─────────────────┬───────────────────┘
                  │ restore SUCCESS?
                  ▼
┌─────────────────────────────────────┐
│ 3a. SUCCESS: Remove from storage    │
│     Delete from items + schedule    │
├─────────────────────────────────────┤
│ 3b. FAILURE: Reschedule             │
│     Move to +5 minutes              │
│     Show notification               │
└─────────────────────────────────────┘
```

### Backup & Recovery Flow

```
Storage write (debounced 3s)
         │
         ▼
┌─────────────────────────────────────┐
│ createBackup()                      │
│ - Save snapshot with timestamp      │
│ - Keep only 3 newest backups        │
└─────────────────────────────────────┘

Extension startup (initStorage)
         │
         ▼
┌─────────────────────────────────────┐
│ Validate snoooze_v2                 │
│ - Check structure (items, schedule) │
│ - Verify referential integrity      │
└─────────────────┬───────────────────┘
                  │ INVALID?
                  ▼
┌─────────────────────────────────────┐
│ recoverFromBackup()                 │
│ - Find newest VALID backup          │
│ - Restore to snoooze_v2             │
│ - Queue recovery notification       │
└─────────────────────────────────────┘
```

---

## Project Structure

```
src/
├── background/
│   ├── serviceWorker.ts    # Event listeners, alarm handler
│   ├── snoozeLogic.ts      # Core snooze/restore logic (~850 LOC)
│   └── schemaVersioning.ts # V1→V2 migration, validation
├── popup/
│   ├── Popup.tsx           # Snooze UI
│   └── hooks/              # useKeyboardNavigation
├── options/
│   ├── Options.tsx         # Main options page
│   ├── SnoozedList.tsx     # Grouped tab list
│   └── *.tsx               # Settings components
├── components/ui/          # shadcn/ui primitives
├── utils/
│   ├── ChromeApi.ts        # Chrome API wrapper
│   ├── timeUtils.ts        # Time calculations
│   ├── validation.ts       # Data validators
│   ├── StorageService.ts   # Import/export helpers
│   └── constants.ts        # Config, defaults
├── messages.ts             # IPC contracts
├── types.ts                # TypeScript interfaces
└── test/
    └── setup.ts            # Vitest chrome mock
```

---

## Chrome API Wrapper (`ChromeApi.ts`)

Centralized abstraction for all Chrome Extension APIs:

- **Promise-based**: Async/await support
- **Error handling**: Consistent try-catch with descriptive messages
- **Firefox compat**: Graceful fallbacks (session storage, getBytesInUse)
- **Testability**: Single mock point

```typescript
// Usage
import { storage, tabs, windows } from '@/utils/ChromeApi';

await storage.getLocal(['snoooze_v2']);
await tabs.create({ url: 'https://...' });
```

---

## Concurrency & Safety

### Storage Mutex

`storageLock` (Promise chain) prevents race conditions on concurrent writes:

```typescript
let storageLock = Promise.resolve();

async function withStorageLock<T>(fn: () => Promise<T>): Promise<T> {
  const release = storageLock;
  let resolve: () => void;
  storageLock = new Promise(r => { resolve = r; });
  await release;
  try {
    return await fn();
  } finally {
    resolve!();
  }
}
```

### Tab Close Safety

Tabs are NEVER closed before storage write succeeds:

```typescript
// snooze()
await storage.setLocal({ snoooze_v2: updated }); // ← Must succeed first
await tabs.remove(tabId);                         // ← Only then close
```

### Restore Retry

Failed tab restores retry 3 times (200ms intervals), then reschedule +5min.
