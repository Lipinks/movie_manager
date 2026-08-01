import * as storage from '../utils/storage';

/**
 * The global tag vocabulary shared by stars and videos.
 *
 * Replaces four near-identical "create tag if new, then persist" handlers that
 * lived in StarManager, StarDetails, VideosPage and VideoFormFields — one of
 * which sorted the cached array in place, corrupting the storage cache.
 */

const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** Every known tag, alphabetically sorted. Always a fresh array. */
export const getTags = () => {
  const stored = storage.getItem(storage.KEYS.TAGS, []);
  return Array.isArray(stored) ? [...stored].sort(byName) : [];
};

/**
 * Add a tag to the global vocabulary if it isn't already there
 * (case-insensitively).
 * @returns the full, sorted tag list — new or unchanged.
 */
export const addTag = (tag) => {
  const trimmed = String(tag ?? '').trim();
  const current = getTags();
  if (!trimmed || current.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
    return current;
  }

  const next = [...current, trimmed].sort(byName);
  storage.setItem(storage.KEYS.TAGS, next);
  return next;
};
