import * as storage from '../utils/storage';
import * as favoritesService from './favoritesService';

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

/**
 * Every category, paired with a thumbnail to represent it on the Category page.
 *
 * The stored vocabulary is the source of truth, but any tag that only exists
 * on a video (data drift, or a tag pulled down from Drive) is included too, so
 * no category can end up unreachable. The thumbnail is simply the first video
 * carrying that tag that actually has an image; tags with no usable image get
 * `imageUrl: null` and the card falls back to a lettered tile.
 *
 * @returns {{name: string, imageUrl: string|null}[]} sorted by name
 */
export const getCategories = () => {
  const videos = favoritesService.listAll();

  const names = new Set(getTags());
  const thumbnailByTag = new Map();

  videos.forEach((video) => {
    (Array.isArray(video.tags) ? video.tags : []).forEach((tag) => {
      names.add(tag);
      if (!thumbnailByTag.has(tag) && video.imageUrl) {
        thumbnailByTag.set(tag, video.imageUrl);
      }
    });
  });

  return [...names]
    .sort(byName)
    .map((name) => ({ name, imageUrl: thumbnailByTag.get(name) || null }));
};
