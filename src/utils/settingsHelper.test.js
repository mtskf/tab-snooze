import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSettingsWithDefaults } from './settingsHelper';
import { storage } from './ChromeApi';
import { DEFAULT_SETTINGS } from './constants';

vi.mock('./ChromeApi', () => ({
  storage: {
    getLocal: vi.fn(),
  },
}));

describe('settingsHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettingsWithDefaults', () => {
    it('should return DEFAULT_SETTINGS merged with system timezone when no settings exist', async () => {
      storage.getLocal.mockResolvedValue({});

      const result = await getSettingsWithDefaults();

      expect(result).toEqual({
        ...DEFAULT_SETTINGS,
        timezone: expect.any(String),
      });
      expect(result.timezone).toBeTruthy();
    });

    it('should merge stored settings with defaults', async () => {
      storage.getLocal.mockResolvedValue({
        settings: {
          'start-day': '9:00 AM',
          customKey: 'customValue',
        },
      });

      const result = await getSettingsWithDefaults();

      expect(result['start-day']).toBe('9:00 AM');
      expect(result['end-day']).toBe(DEFAULT_SETTINGS['end-day']);
      expect(result.customKey).toBe('customValue');
      expect(result.timezone).toBeTruthy();
    });

    it('should use stored timezone if available', async () => {
      storage.getLocal.mockResolvedValue({
        settings: {
          timezone: 'America/New_York',
        },
      });

      const result = await getSettingsWithDefaults();

      expect(result.timezone).toBe('America/New_York');
    });

    it('should return defaults when storage.getLocal throws', async () => {
      storage.getLocal.mockRejectedValue(new Error('Storage API failed'));

      const result = await getSettingsWithDefaults();

      expect(result).toEqual({
        ...DEFAULT_SETTINGS,
        timezone: expect.any(String),
      });
    });

    it('should call storage.getLocal with "settings" key', async () => {
      storage.getLocal.mockResolvedValue({});

      await getSettingsWithDefaults();

      expect(storage.getLocal).toHaveBeenCalledWith('settings');
    });
  });
});
