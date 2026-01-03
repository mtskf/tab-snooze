# Backlog

## Auto backup fallback for snoozed tabs

Goal: Automatically restore from a recent backup if the primary `snoozedTabs` payload is missing or corrupted, without adding UI.

### Scope
- Detect invalid/empty `snoozedTabs` at startup and recover from the latest backup.
- Keep a small number of rotating backups (recommend 3).
- Notify the user only when a recovery actually happens.

### Proposed design
1. **Backup format**
   - Store a copy under `snoozedTabs_backup_<timestamp>` in `chrome.storage.local`.
   - Use a simple JSON payload identical to `snoozedTabs`.

2. **Backup creation**
   - On every successful write to `snoozedTabs`, also write/rotate backups.
   - Keep 3 generations; delete older keys during rotation.
   - If in-memory `snoozedTabs` is detected as invalid at save time:
     - Recover a valid base (latest backup) inside the storage lock.
     - Re-apply the pending change to the recovered base, then save.
     - Only rotate backups after a successful save (avoid overwriting good backups with bad data).
   - **Debounce rotation**: To avoid excessive I/O during rapid writes (e.g., snoozing multiple tabs quickly), debounce backup rotation by 2-3 seconds after the last write, or rotate only every N writes (e.g., every 5th write). Use a module-level timer that resets on each write.

3. **Integrity checks**
   - Validate before backup and before any recovery attempt.
   - Treat `snoozedTabs` as invalid if:
     - missing
     - not an object
     - missing `tabCount` key
     - `tabCount` is not a non-negative number
     - has malformed timestamp keys (non-numeric) with array values
     - tab entries are not arrays
   - Reduce false positives:
     - Only require minimal fields per tab (`url`, `creationTime`, `popTime`); treat `title` as optional.
     - Accept unknown/extra fields for forward and backward compatibility.
     - If some tab entries are invalid, drop only those entries instead of invalidating the entire payload.
     - If `tabCount` does not match, recompute it rather than treating the payload as invalid.

4. **Recovery flow**
   - At `initStorage()`, if invalid, scan backups (latest first) and restore.
   - Also check on Snooooze dashboard open (Options/Popup mount) and restore if invalid.
     - Prefer a background message like `ensureSnoozedTabs` that validates/repairs, then returns the current (post-recovery) payload.
     - UI should use that response for initial render, and still listen to `storage.onChanged` for updates.
     - **Race condition prevention**: The `ensureSnoozedTabs` handler in the service worker must acquire `storageLock` before performing validation/recovery. This ensures that concurrent requests from multiple Popup/Options windows are serialized and only one recovery executes.
   - Restore the first valid backup into `snoozedTabs`.
   - Emit a one-time notification: "Recovered X snoozed tabs from backup" (include count for user clarity).
   - If invalid data is detected during save, recover immediately, then re-apply and save (to avoid losing the just-snoozed data).

5. **Edge handling**
   - If no valid backups exist, fall back to `{ tabCount: 0 }`.
   - Ensure validation, backup rotation, and recovery are protected by the existing storage mutex.

6. **Migration for existing users**
   - On first run after update, if `snoozedTabs` is valid but no backups exist, immediately create `backup_0` from current data.
   - Ensures existing users have at least one backup before any future corruption could occur.

7. **Notification deduplication**
   - Store `lastRecoveryNotifiedAt` in `chrome.storage.session` (ephemeral, cleared on browser restart).
   - Skip notification if a recovery notification was shown within the last 5 minutes.
   - Prevents repeated notifications when SW restarts multiple times.

### Files likely to change (later implementation)
- `src/background/snoozeLogic.js` (storage helpers, init flow)
- `src/background/serviceWorker.js` (notifications, recovery hook)
- `src/utils/validation.js` (new file for validation logic)

### Design decisions
- **Runtime recovery**: Yes, recovery should also be attempted when storage read fails at runtime. Implement a `getValidatedSnoozedTabs()` wrapper that validates on read and triggers recovery if needed, providing a single point of control.

## Storage size warning (separate feature)

Goal: Warn users when `chrome.storage.local` usage for `snoozedTabs` approaches the limit.

### Proposed design
1. **Size estimation**
   - Use `chrome.storage.local.getBytesInUse` to measure actual bytes used.
   - Track bytes for `snoozedTabs` and backup keys (sum), not the whole store.
   - Compare against a warning threshold (e.g., 80% of 10MB).
   - Add hysteresis (e.g., warn at 80%, clear warning at 70%) to prevent flapping.

2. **Trigger**
   - Evaluate on each `snoozedTabs` write (same place as backup rotation).
   - Debounce notifications to avoid spam.
   - Persist `lastSizeWarningAt` to throttle (e.g., once per 24h).

3. **User messaging**
   - Short notification: "Snooooze storage is almost full. Open Snoozed list to delete or restore old tabs."
   - Clicking notification opens Options to the Snoozed list.
   - Keep wording consistent with in-app UI (same icon/label).

### Risks and mitigations
- **Overcount/undercount**: `getBytesInUse` includes storage overhead; use it as the source of truth and avoid JSON-length heuristics.
- **Warning spam**: Use throttling + hysteresis to reduce repeated alerts.
- **User confusion**: Provide explicit next steps in the message (delete old tabs or restore them).
- **No safe auto-cleanup**: Do not auto-delete data; only prompt the user.

### Cleanup actions (definition)
- "Cleanup" means user-driven actions in Snoozed list:
  - delete snoozed tabs individually
  - restore tabs and then clear them if no longer needed
  - export JSON and then clear (optional)

### UI consistency
- Prefer a consistent UX path by opening Options (Snoozed list) when the notification is clicked.
- Optionally show a small in-app banner in Options/Popup when `sizeWarningActive` is set.
  - Set `sizeWarningActive: true` when threshold is exceeded; clear when usage drops below the lower threshold.
  - Banner copy should mirror the notification: “Storage is almost full. Delete or restore old tabs.”
