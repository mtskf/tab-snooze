import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock Chrome API with proper typing
const chromeMock = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    lastError: undefined,
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
  windows: {
    getLastFocused: vi.fn(),
    create: vi.fn(),
  },
} as unknown as typeof chrome;

vi.stubGlobal('chrome', chromeMock);
(window as { chrome?: typeof chrome }).chrome = chromeMock;
(globalThis as { chrome?: typeof chrome }).chrome = chromeMock;
console.log('Setup file loaded, chrome mock assigned');
