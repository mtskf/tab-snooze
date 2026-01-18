# Project Rules

> Quick reference for AI coding assistants

See more details:

- `dev-docs/ARCHITECTURE.md` - Implementation details (structure, algorithms, file organization)
- `dev-docs/SPEC.md` - Requirements (behavior, timing, constraints)

## Overview

Chrome Extension (Manifest V3) - Snooze tabs and automatically restore them at a specified time

- **Stack**: React 18 + TypeScript, Tailwind CSS + shadcn/ui, Vite, Vitest
- **Entry Point**: `src/background/serviceWorker.ts` (Alarm, onInstalled, onStartup)
- **Data Model**: `snoooze_v2` - items (UUID→Item), schedule (timestamp→UUIDs)
- **Storage**: chrome.storage.local (main) + chrome.storage.session (failed tabs)
- **Flow**: Snooze (validate→save→close) → Restore (alarm→retry 3x→reschedule if failed)
- **Concurrency**: Promise-chain mutex + 2s backup debounce + restore flag
- **Backup/Recovery**: 3-tier (valid→sanitized→empty), recovery notify: 5min, storage warning: 24h

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (HMR enabled) |
| `npm run build` | Production build to `dist/` |
| `npm test` | Run all tests |
| `npm run typecheck` | Type check |

## Code Style

- TypeScript strict mode, no `any` types
- Use named exports, not default exports
- CSS: use Tailwind utility classes, no custom CSS files

## Testing

- External APIs must be mocked
- Chrome API mocked via `@/utils/ChromeApi.ts`

## Constraints

- Manifest V3: Service Worker environment (no DOM API)
- Storage: chrome.storage.local (quota limits apply)
