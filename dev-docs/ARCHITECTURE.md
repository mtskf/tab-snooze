# Architecture Overview

Quick reference for system design and implementation.

## Project Structure

```
Snooooze/
├── src/
│   ├── background/          # Service Worker (Manifest V3)
│   │   └── serviceWorker.js # Alarm handling, tab restoration, storage
│   ├── popup/               # Extension popup UI
│   │   └── Popup.jsx        # Snooze options, scope selection
│   ├── options/             # Options/Settings page
│   │   └── Options.jsx      # Snoozed list, settings management
│   ├── components/ui/       # shadcn/ui components
│   ├── utils/               # Shared utilities
│   │   └── timeUtils.js     # Time calculations, timezone handling
│   ├── lib/                 # shadcn utilities (cn)
│   └── index.css            # Global styles (Neo Carbon theme)
├── dist/                    # Built extension
├── docs/                    # GitHub Pages (Website)
├── dev-docs/                # Developer Documentation
└── public/assets/           # Icons, manifest.json
```

## Core Components

### Service Worker (`serviceWorker.js`)
- **Alarm System**: `popCheck` runs every minute (or on startup) to restore overdue tabs
- **Storage**: `chrome.storage.local` for snoozed tabs and settings
- **Restoration**: Directly opens tabs when time is reached
- **Mutex Lock**: Prevents race conditions during batch operations

### Popup (`Popup.jsx`)
- **Scope Selection**: "Selected tabs" or "Window" (Shift key toggle)
- **Snooze Options**: Later today, Evening, Tomorrow, Weekend, etc.
- **Keyboard Shortcuts**: 1-7 for options, Shift+key for window scope
- **Snoozed Counter**: Shows pending tab count (999+ for large numbers)

### Options (`Options.jsx`)
- **Snoozed List**: Grouped by date, with delete/restore actions
- **Settings**: Morning/Evening times, Timezone (grouped dropdown)
- **Export/Import**: JSON format (preserves timestamps)
- **URL Hash**: Supports `#settings` to open directly to Settings tab

## Data Storage

### `snoozedTabs` (chrome.storage.local)
```javascript
{
  "tabCount": 42,
  "1702700400000": [  // timestamp as key
    { url, title, favIconUrl, creationTime, openInNewWindow }
  ]
}
```

### `settings` (chrome.storage.local)
```javascript
{
  "start-day": "9:00 AM",
  "end-day": "6:00 PM",
  "timezone": "Australia/Sydney",
  "open-new-tab": "true"
}
```

## Key Flows

### Snooze Flow
1. User selects scope (tabs/window) and time option
2. Popup queries tabs, sends `snooze` message to service worker
3. Service worker stores tabs under timestamp key
4. Tab is closed; popup window closes

### Restore Flow
1. `popCheck` alarm fires (every 1 min, or on startup)
2. Checks timestamps < `Date.now()`
3. **Directly restores tabs** (Current Window or New Window based on settings)
4. Removes from storage

## Technologies
- **React** + **Vite** for UI
- **shadcn/ui** + **Tailwind CSS** for components
- **lucide-react** for icons
- **Chrome Extension Manifest V3**
