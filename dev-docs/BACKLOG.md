# Backlog

## Storage size warning (separate feature)

Goal: Warn users when `chrome.storage.local` usage approaches the limit.

### Design

#### 1. Size estimation
- Use `chrome.storage.local.getBytesInUse(null)` to measure **total** bytes used (simpler than filtering keys).
- Compare against thresholds (10MB = 10,485,760 bytes):
  - **Warning threshold**: 80% (8,388,608 bytes)
  - **Clear threshold**: 70% (7,340,032 bytes) — hysteresis to prevent flapping
- Store `sizeWarningActive: boolean` in `chrome.storage.local` (persists across browser restarts).

#### 2. Trigger
- Evaluate on each `snoozedTabs` write (after `scheduleBackupRotation()` in `setSnoozedTabs()`).
- **Also check once on startup** (`initStorage()`) to catch pre-existing high usage.
- Debounce size check together with backup rotation (use same timer).
- Persist `lastSizeWarningAt` in `chrome.storage.local` to throttle notifications (once per 24h).

#### 3. Notification
- Message: "Snooooze storage is almost full. Open Snoozed list to delete or restore old tabs."
- Click handler opens Options page (`chrome.notifications.onClicked` in `serviceWorker.js`).
- Icon: `assets/icon128.png` (existing).

#### 4. In-app banner (Options.jsx)
- Use `shadcn/ui Alert` with `variant="destructive"`.
- Show when `sizeWarningActive === true` (read from `chrome.storage.local` on mount).
- Listen to `chrome.storage.onChanged` to update reactively.
- Copy: "Storage is almost full. Delete or restore old tabs to free up space."

#### 5. Firefox compatibility
- `chrome.storage.local.getBytesInUse()` is **not supported in Firefox**.
- Wrap in try-catch; if error, silently disable warning feature (no notification, no banner).
- Firefox users will not see storage warnings, but extension remains functional.

### Implementation checklist
- [ ] Add `checkStorageSize()` in `snoozeLogic.js` (with try-catch for Firefox)
- [ ] Call from `scheduleBackupRotation()` debounce timer
- [ ] Call once from `initStorage()` on startup
- [ ] Add `chrome.notifications.onClicked` handler in `serviceWorker.js`
- [ ] Add `Alert` banner in `Options.jsx` (install `shadcn/ui alert` if needed)
- [ ] Add storage keys: `sizeWarningActive`, `lastSizeWarningAt`
- [ ] Update `ARCHITECTURE.md` with new storage keys

### Risks and mitigations
| Risk | Mitigation |
|------|------------|
| Warning spam | 24h throttle + hysteresis (80%/70%) |
| Service Worker timer loss | Acceptable; 24h throttle is final defense |
| User confusion | Clear CTA in message ("delete or restore") |
| Auto-cleanup risk | Never auto-delete; user-driven only |
| Firefox incompatibility | Graceful fallback; feature disabled silently |

### Cleanup actions (user-driven)
- Delete snoozed tabs individually
- Restore tabs and clear if no longer needed
- Export JSON and then clear (optional)”
