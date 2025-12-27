# Technology Stack

## Core
- **Runtime**: Chrome Extension Manifest V3
- **Language**: JavaScript (ESNext)
- **Framework**: React 18, Vite

## Styling & UI
- **CSS Engine**: Tailwind CSS
- **Component Library**: shadcn/ui (Radix UI based)
- **Icons**: Lucide React

## State & Logic
- **Storage**: `chrome.storage.local` (Snoozed tabs)
- **Time/Date**: Native `Intl` API, `date-fns`, `date-fns-tz`

## Tooling
- **Package Manager**: pnpm
- **Build**: CRXJS Vite Plugin
- **Lint/Format**: ESLint, Prettier
- **Testing**: Vitest (Recommended)

## Key Conventions
- **Components**: Functional components with hooks.
- **Naming**: PascalCase for components, camelCase for functions/vars.
- **Imports**: Absolute imports `@/` configured in Vite.
