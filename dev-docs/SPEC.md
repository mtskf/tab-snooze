# Functional Specifications

> User requirements (behavior, timing, constraints)

## Terminology

| Term | Definition |
|------|------------|
| Snooze | Close tab(s), schedule restoration |
| Restore | Reopen snoozed tab at scheduled time |
| Scope | "Selected Tabs" (highlighted) or "Current Window" |
| Window Group | Tabs snoozed together with shared `groupId` |

## Snooze

**URL Validation:**

- Skip invalid/restricted URLs (e.g., `chrome://`, `chrome-extension://`)
- Tab remains open if URL is not restorable

**Timing:**

All times use user's timezone (settings → system fallback).

**Day-of-week reference**: Uses JavaScript `Date.getDay()` convention (0=Sunday, 6=Saturday)

| Option | Logic | Default |
|--------|-------|---------|
| Later Today | +1 hour (preserves minutes) | - |
| This Evening | Today at `end-day` <br> Hidden if past `end-day` | 5:00 PM |
| Tomorrow | Tomorrow at `start-day` <br> Exception: Before `start-day` → today ("This morning") | 8:00 AM |
| This Weekend | Next `weekend-begin` at `start-day` | Sat 8:00 AM |
| Next Monday | Next Mon at `start-day` | 8:00 AM |
| In a Week | +7 days at `start-day` | 8:00 AM |
| In a Month | +1 month at `start-day` | 8:00 AM |
| Pick Date | Selected date at `start-day` | 8:00 AM |

**Early Morning Exception**: If current hour < `start-day` (default 8AM), "Tomorrow" uses today's date → displays "This morning"

## Scope & Shortcuts

**Scope:**
- **Selected Tabs**: Highlighted tabs, no `groupId` → restore in last-focused window
- **Current Window**: All tabs, shared `groupId` → restore in new window

**Keyboard:**
- Single key (e.g., `T`) → Snooze selected tabs
- `Shift` + key → Snooze entire window
- `Shift + P` or window scope → DatePicker preserves scope
- Customizable in Options UI

## Restore

- Alarm every 1 min + on install/startup
- Skip if offline or already restoring
- Restore comparison: `popTime < now` (tabs restore when scheduled time is in the past, not equal to current time)
- Restore grouped tabs → new window | ungrouped → last-focused window (fallback: new window)
- Retry 3x with 200ms intervals
- Failed tabs → Save to session storage, reschedule +5min, show notification

## UI Themes

Defined in `constants.ts`:
- **Default**: Blue/Indigo monochrome
- **Vivid**: Semantic colors (Tomorrow=Blue, Weekend=Green)
- **Heatmap**: Urgency colors (Later Today=Red, Tomorrow=Orange)

## Data Integrity

**Backup:**
- 3 rotating backups: `snoozedTabs_backup_<ts>`
- Debounced 2s
- Validates before backup

**Recovery:**
- On startup: Validate `snoooze_v2`
- If invalid → `recoverFromBackup` (valid → sanitized with most items → empty reset)
- `ensureValidStorage` sanitizes invalid entries
- Notify user with recovered item count (5-min cooldown for recovery notifications)

**Import:**

- Reject future schema versions (> current version)
- Validation (no URL validation for existing entries)
- Regenerate UUIDs on collision
- Repair mode for minor issues
- Merge with existing data (no overwrite)

## Storage & UI Features

**Storage Warning:**

- Warning: 8MB (80%), Clear: 7MB (70%) - hysteresis pattern
- Notify once per 24h (separate cooldown from recovery notifications)
- In-app banner in Options
- Firefox: Disabled (`getBytesInUse` unsupported)

**UI Features:**

- Search/filter snoozed items (by title/URL)
- Failed restore dialog (session storage → Options)
- Undo delete (via `useUndoDelete`)
- Clear all (with confirmation)
