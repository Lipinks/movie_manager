import * as storage from '../utils/storage';

/**
 * Light / dark appearance.
 *
 * Light is the default. The choice is remembered per browser and is not
 * synced to Drive, so a phone and a laptop can differ. Dark mode is the
 * attribute <html data-theme="dark">, which styles/theme.css keys off;
 * public/index.html applies a saved choice before the app loads, so a dark
 * page never flashes light first.
 */

export const THEMES = { LIGHT: 'light', DARK: 'dark' };

const listeners = new Set();

const readSaved = () => {
  try {
    return storage.getRaw(storage.KEYS.THEME) === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  } catch {
    return THEMES.LIGHT; // storage blocked (e.g. some private windows)
  }
};

const apply = (theme) => {
  // Light mode is the page exactly as it was before themes existed: no attribute.
  if (theme === THEMES.DARK) document.documentElement.dataset.theme = THEMES.DARK;
  else delete document.documentElement.dataset.theme;
};

let current = readSaved();
apply(current);

/** @returns {'light'|'dark'} */
export const getTheme = () => current;

export const setTheme = (theme) => {
  current = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  apply(current);
  try {
    storage.setRaw(storage.KEYS.THEME, current);
  } catch {
    // Can't remember it, but it still applies for this visit.
  }
  listeners.forEach((listener) => listener(current));
};

export const toggleTheme = () => setTheme(current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK);

/** @returns {() => void} unsubscribe (for useSyncExternalStore) */
export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
