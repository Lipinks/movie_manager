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
 * Give as many tags as possible a thumbnail no other tag is using.
 *
 * This is a maximum bipartite matching between tags and image URLs, solved
 * with Kuhn's augmenting-path algorithm: each tag claims a free image, and if
 * every candidate is taken it asks the current holder to move to one of *its*
 * other candidates, recursively. That reshuffling is what a greedy first-come
 * pick cannot do — it is why a tag with options gives way to a tag with none.
 *
 * Deterministic: tags are processed in the caller's sorted order and each
 * tag's candidates keep the order the videos were read in, so the same data
 * always produces the same assignment.
 *
 * @param {string[]} orderedTags
 * @param {Map<string, string[]>} candidatesByTag
 * @returns {Map<string, string>} tag -> uniquely assigned image URL
 */
const matchDistinctThumbnails = (orderedTags, candidatesByTag) => {
  const tagByImage = new Map();
  const imageByTag = new Map();

  const claim = (tag, visitedImages) => {
    for (const image of candidatesByTag.get(tag) || []) {
      if (visitedImages.has(image)) continue;
      visitedImages.add(image);

      const holder = tagByImage.get(image);
      // Free image, or the current holder can be rehoused elsewhere.
      if (holder === undefined || claim(holder, visitedImages)) {
        tagByImage.set(image, tag);
        imageByTag.set(tag, image);
        return true;
      }
    }
    return false;
  };

  orderedTags.forEach((tag) => claim(tag, new Set()));
  return imageByTag;
};

/**
 * Every category, paired with a thumbnail to represent it on the Category page.
 *
 * The stored vocabulary is the source of truth, but any tag that only exists
 * on a video (data drift, or a tag pulled down from Drive) is included too, so
 * no category can end up unreachable.
 *
 * Thumbnails are made as distinct as the data allows. Because one video can
 * carry several tags, simply taking each tag's first image made every tag on a
 * shared video show the same picture. Instead the tag→image choice is solved
 * as a maximum bipartite matching (see `matchDistinctThumbnails`), so a tag
 * that has alternatives yields its contested image to a tag that has none.
 *
 * A tag only repeats another tag's image when it genuinely has no other
 * candidate; a tag with no usable image at all gets `imageUrl: null` and the
 * card falls back to a lettered tile.
 *
 * @returns {{name: string, imageUrl: string|null}[]} sorted by name
 */
export const getCategories = () => {
  const videos = favoritesService.listAll();

  const names = new Set(getTags());
  /** tag -> distinct candidate image URLs, in a stable order */
  const candidatesByTag = new Map();

  videos.forEach((video) => {
    (Array.isArray(video.tags) ? video.tags : []).forEach((tag) => {
      names.add(tag);
      if (!video.imageUrl) return;

      const candidates = candidatesByTag.get(tag) || [];
      if (!candidates.includes(video.imageUrl)) candidates.push(video.imageUrl);
      candidatesByTag.set(tag, candidates);
    });
  });

  const ordered = [...names].sort(byName);
  const assigned = matchDistinctThumbnails(ordered, candidatesByTag);

  return ordered.map((name) => ({
    name,
    // Fall back to a shared image only when matching proved none is free —
    // showing the real (duplicated) thumbnail beats showing a blank tile.
    imageUrl: assigned.get(name) || candidatesByTag.get(name)?.[0] || null,
  }));
};
