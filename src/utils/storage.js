/**
 * Cached localStorage wrapper.
 * 
 * Avoids redundant JSON.parse() calls by keeping an in-memory cache.
 * Every getItem() returns the cached copy if available; setItem() updates
 * both localStorage and the cache in one shot.
 */

const cache = new Map();

/**
 * Read a JSON value from localStorage (cached).
 * @param {string} key           localStorage key
 * @param {*}      defaultValue  value returned when key is missing / null
 * @returns {*}    parsed value or defaultValue
 */
export const getItem = (key, defaultValue = null) => {
  if (cache.has(key)) return cache.get(key);

  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;

  try {
    const parsed = JSON.parse(raw);
    cache.set(key, parsed);
    return parsed;
  } catch {
    return defaultValue;
  }
};

/**
 * Write a JSON value to localStorage and update the cache.
 * @param {string} key
 * @param {*}      value  will be JSON-stringified
 */
export const setItem = (key, value) => {
  cache.set(key, value);
  localStorage.setItem(key, JSON.stringify(value));
};

/**
 * Read a raw (non-JSON) string from localStorage.
 * Used for tokens / simple strings.
 */
export const getRaw = (key) => localStorage.getItem(key);

/**
 * Write a raw string to localStorage (no JSON wrapping).
 */
export const setRaw = (key, value) => {
  cache.delete(key); // not JSON-cached
  localStorage.setItem(key, value);
};

/**
 * Remove a key from both cache and localStorage.
 */
export const removeItem = (key) => {
  cache.delete(key);
  localStorage.removeItem(key);
};

/**
 * Invalidate the in-memory cache for a key (forces re-read on next getItem).
 * Useful after external code writes directly to localStorage.
 */
export const invalidate = (key) => {
  cache.delete(key);
};

/** Convenience: common keys */
export const KEYS = {
  ACCESS_TOKEN: 'accessToken',
  STARS: 'stars',
  FAVORITES: 'favorites',
  TAGS: 'tags',
  YOUTUBE: 'youtube',
};
