import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Chrome API
const chromeMock = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    sync: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
    }
  },
  runtime: {
    sendMessage: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
  action: {
    setBadgeText: vi.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
  },
  windows: {
    getLastFocused: vi.fn(),
    create: vi.fn(),
  },
};

vi.stubGlobal('chrome', chromeMock);
window.chrome = chromeMock;
globalThis.chrome = chromeMock;
console.log('Setup file loaded, chrome mock assigned');
