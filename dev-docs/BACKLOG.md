# Backlog

## Completed Features

### Storage Size Warning (v0.2.7)
- **Goal**: Warn users when `chrome.storage.local` usage approaches limit.
- **Status**: Implemented.
  - Notification at 80% usage (24h throttle).
  - In-app Alert banner.
  - Firefox fallback included.
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
