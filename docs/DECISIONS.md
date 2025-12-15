# Architecture Decision Records

Documents significant architectural decisions made during development.

## ADR-001: Revert Window Grouping
- **Context**: We initially implemented a feature to group snoozed tabs by their original "Window" in the Options UI.
- **Decision**: We reverted this change.
- **Consequences**: Snoozed tabs are stored and displayed individually. This simplifies the restoration logic and gives users more granular control over individual tabs, while still allowing them to snooze a whole window at once (creates multiple individual snooze entries).

## ADR-002: Global Restoration Context
- **Context**: Tabs could be restored in "Current Window" or "New Window". Originally this was partly dependent on whether they were snoozed as a window.
- **Decision**: The "Open in New Tab" setting in Options now globally dictates the restoration target.
    - If ON: All tabs restore in the *Current Window* (as new tabs).
    - If OFF: All tabs restore in a *New Window*.
- **Consequences**: Behavior is predictable and user-configurable globally, rather than context-dependent.

## ADR-003: Timezone Handling
- **Context**: Browsers run on system time. Users may want to snooze based on a specific timezone (e.g., working remotely).
- **Decision**: We calculate target times by "shifting" the `Date` object based on the delta between the system time and the target timezone time.
- **Consequences**: We avoid heavy timezone libraries. `9:00 AM` in the target setting triggers when the wall-clock time in that zone is 9:00 AM, regardless of the user's actual system clock (relative calculation).
