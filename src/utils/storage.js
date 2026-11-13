/**
 * Cached localStorage wrapper.
 *
 * Avoids redundant JSON.parse() calls by keeping an in-memory cache. Every
 * getItem() returns the cached copy if available; setItem() updates both
 * localStorage and the cache in one shot.
 *
 * IMPORTANT: getItem() returns the cached object *by reference*. Never mutate
 * what it hands back — doing so silently desyncs the cache from localStorage
 * when the follow-up setItem() never happens (early return, thrown error).
 * Always build a new value and pass it to setItem(). The services in
 * `src/services` are the intended way to read/write the app's domain data.
 */

const cache = new Map();

/** Marks "this key is genuinely absent" so misses are cached too. */
const MISS = Symbol('storage-miss');

/* ------------------------------------------------------------------ *
 * Change notifications
 *
 * Auto-sync listens here to notice local edits, so no service has to
 * report its own writes. Writes that merely store a copy downloaded from
 * Drive pass `{ fromRemote: true }`, which tells auto-sync not to upload
 * them straight back.
 * ------------------------------------------------------------------ */

const listeners = new Set();

/**
 * @param {(key: string, info: {fromRemote: boolean}) => void} listener
 *        called after every successful setItem() / removeItem()
 * @returns {() => void} unsubscribe
 */
export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emit = (key, fromRemote) => {
  listeners.forEach((listener) => listener(key, { fromRemote }));
};

/**
 * Read a JSON value from localStorage (cached, including negative lookups).
 * @param {string} key           localStorage key
 * @param {*}      defaultValue  value returned when key is missing / unparseable
 * @returns {*}    parsed value or defaultValue
 */
export const getItem = (key, defaultValue = null) => {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached === MISS ? defaultValue : cached;
  }

  const raw = localStorage.getItem(key);
  if (raw === null) {
    cache.set(key, MISS);
    return defaultValue;
  }

  try {
    const parsed = JSON.parse(raw);
    cache.set(key, parsed);
    return parsed;
  } catch {
    console.warn(`[storage] Corrupt JSON under "${key}" — using the default value.`);
    cache.set(key, MISS);
    return defaultValue;
  }
};

/**
 * Write a JSON value to localStorage and update the cache.
 * On failure (e.g. quota exceeded) the cache is rolled back so it never
 * disagrees with what is actually persisted, and the error is rethrown.
 * @param {string} key
 * @param {*}      value  will be JSON-stringified
 * @param {{fromRemote?: boolean}} [options]  fromRemote marks a copy
 *        downloaded from Drive rather than a local edit
 */
export const setItem = (key, value, { fromRemote = false } = {}) => {
  const hadPrevious = cache.has(key);
  const previous = cache.get(key);

  cache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    if (hadPrevious) cache.set(key, previous);
    else cache.delete(key);
    console.error(`[storage] Failed to persist "${key}":`, error);
    throw error;
  }
  emit(key, fromRemote);
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
  emit(key, false);
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
  TOKEN_EXPIRY: 'accessTokenExpiry',
  STARS: 'stars',
  FAVORITES: 'favorites',
  TAGS: 'tags',
  YOUTUBE: 'youtube',
  /** { [tag]: imageUrl } — manually chosen category cover images. */
  CATEGORY_THUMBNAILS: 'categoryThumbnails',
  /** Saved websites shown on the Updates page. */
  UPDATES: 'updates',
  /** Raw '1' while local edits are waiting to be uploaded to Drive. */
  SYNC_PENDING: 'syncPending',
  /** { [fileName]: modifiedTime } of each Drive file as last downloaded or uploaded here. */
  DRIVE_VERSIONS: 'driveFileVersions',
};
