import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Chrome API with proper typing to avoid type inference issues
/** @type {typeof chrome} */
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
};

vi.stubGlobal('chrome', chromeMock);
// @ts-expect-error - intentionally assigning mock to global
window.chrome = chromeMock;
// @ts-expect-error - intentionally assigning mock to global
globalThis.chrome = chromeMock;
console.log('Setup file loaded, chrome mock assigned');
