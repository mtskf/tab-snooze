import { storage } from './ChromeApi';
import { DEFAULT_SETTINGS } from './constants';
import type { Settings } from '../types';

/**
 * Gets settings from storage merged with defaults.
 * Falls back to defaults if storage access fails.
 */
export async function getSettingsWithDefaults(): Promise<Settings> {
  const defaults: Settings = {
    ...DEFAULT_SETTINGS,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  try {
    const res = await storage.getLocal('settings');
    if (!res.settings) {
      return defaults;
    }
    return { ...defaults, ...(res.settings as Partial<Settings>) };
  } catch (error) {
    console.warn('Failed to fetch settings, using defaults:', error);
    return defaults;
  }
}
