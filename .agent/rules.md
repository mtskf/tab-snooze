# Project Rules

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome拡張機能（Manifest V3）- タブをスヌーズして指定時刻に自動復元

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (HMR enabled) |
| `npm run build` | Production build to `dist/` |
| `npm test` | Run all tests |
| `npm test -- src/path/to/file.test.ts` | Run single test file |
| `npm test -- --watch` | Watch mode |
| `npm run typecheck` | Type check |


**Load extension for development:**
- Navigate to `chrome://extensions/`
- Enable "Developer mode" (toggle in top right)
- Click "Load unpacked"
- Select the `dist/` directory

## Architecture

```
Popup/Options UI  →  chrome.runtime.sendMessage  →  Service Worker (Background)
                                                           ↓
                                                    snoozeLogic.ts
                                                           ↓
                                                    Chrome Storage (snoooze_v2)
```

**Core files:**
- `src/background/snoozeLogic.ts` - Core snooze/restore logic, storage mutex
- `src/background/serviceWorker.ts` - Event listeners, alarm handler
- `src/messages.ts` - UI ↔ Background IPC contract
- `src/utils/ChromeApi.ts` - Promise-based Chrome API wrapper

**Safety invariant:** Tabs are NEVER closed before storage write succeeds.

## Development Notes

- TypeScript + ES Modules
- External API calls: `try-catch` + retry
- Update dev-docs/ on task completion

## Documentation (dev-docs/)

| File | Content |
|------|---------|
| ARCHITECTURE.md | Full architecture, data model, flows |
| SPEC.md | Feature specifications |
| DECISIONS.md | Design decision records |
