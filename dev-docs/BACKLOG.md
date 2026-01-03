# Backlog



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
