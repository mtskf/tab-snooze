import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Chrome API
const chromeMock = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
    sync: {
        get: vi.fn(),
        set: vi.fn(),
    }
  },
  runtime: {
    sendMessage: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  }
};

vi.stubGlobal('chrome', chromeMock);
window.chrome = chromeMock;
globalThis.chrome = chromeMock;
console.log('Setup file loaded, chrome mock assigned');
