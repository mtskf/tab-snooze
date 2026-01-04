import { storage } from './ChromeApi';
import { DEFAULT_SETTINGS } from './constants';

/**
 * Gets settings from storage merged with defaults.
 * Falls back to defaults if storage access fails.
 * @returns {Promise<Object>} Settings with defaults applied
 */
export async function getSettingsWithDefaults() {
  const defaults = {
    ...DEFAULT_SETTINGS,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  try {
    const res = await storage.getLocal('settings');
    if (!res.settings) {
      return defaults;
    }
    return { ...defaults, ...res.settings };
  } catch (error) {
    console.warn('Failed to fetch settings, using defaults:', error);
    return defaults;
  }
}
