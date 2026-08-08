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
 * Delete a category.
 *
 * The tag is dropped from the vocabulary *and* un-assigned from every video
 * that carried it. No video is deleted, and each video keeps all of its other
 * tags and fields — a category is metadata, so removing it only severs the
 * relationship.
 *
 * @returns the remaining, sorted tag list
 */
export const deleteTag = (tag) => {
  // Un-tag first: if this throws (e.g. storage quota) the vocabulary is left
  // intact, so the category is still visible rather than silently orphaned.
  favoritesService.removeTagEverywhere(tag);
  clearCategoryThumbnail(tag);

  const next = getTags().filter((existing) => existing !== tag);
  storage.setItem(storage.KEYS.TAGS, next);
  return next;
};

/* ------------------------------------------------------------------ *
 * Category cover images
 *
 * By default a category's card picture is chosen automatically. A manual
 * pick, stored as `{ [tag]: imageUrl }`, overrides that. The URL is stored
 * rather than a video id so the cover survives untouched as long as the
 * picture is still used by some video in the category.
 * ------------------------------------------------------------------ */

const readThumbnailOverrides = () => {
  const stored = storage.getItem(storage.KEYS.CATEGORY_THUMBNAILS, {});
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
};

/** The manually chosen cover for a category, or null when it is automatic. */
export const getCategoryThumbnail = (tag) => readThumbnailOverrides()[tag] || null;

/** Pin a category's card image to a specific thumbnail. */
export const setCategoryThumbnail = (tag, imageUrl) => {
  storage.setItem(storage.KEYS.CATEGORY_THUMBNAILS, { ...readThumbnailOverrides(), [tag]: imageUrl });
};

/** Drop the manual pick so the category goes back to an automatic cover. */
export const clearCategoryThumbnail = (tag) => {
  const current = readThumbnailOverrides();
  if (!(tag in current)) return;

  const next = { ...current };
  delete next[tag];
  storage.setItem(storage.KEYS.CATEGORY_THUMBNAILS, next);
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
 * Manually pinned covers are seeded first and are never moved — a user's
 * explicit choice outranks the algorithm, and holding its image also stops
 * another category from taking it.
 *
 * @param {string[]} orderedTags
 * @param {Map<string, string[]>} candidatesByTag
 * @param {Map<string, string>} pinnedByTag
 * @returns {Map<string, string>} tag -> assigned image URL
 */
const matchDistinctThumbnails = (orderedTags, candidatesByTag, pinnedByTag) => {
  const tagByImage = new Map();
  const imageByTag = new Map();

  pinnedByTag.forEach((image, tag) => {
    // Two categories may be pinned to the same picture on purpose; both keep
    // it, and the first one recorded holds the slot against auto-assignment.
    if (!tagByImage.has(image)) tagByImage.set(image, tag);
    imageByTag.set(tag, image);
  });

  const claim = (tag, visitedImages) => {
    // A pinned category never gives up its image to make room for another.
    if (pinnedByTag.has(tag)) return false;

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

  orderedTags.forEach((tag) => {
    if (!pinnedByTag.has(tag)) claim(tag, new Set());
  });
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
 * A manually chosen cover always wins, provided the picture is still in use
 * by a video in that category — otherwise the pick is stale (its video was
 * un-tagged or deleted) and the automatic choice takes over again.
 *
 * @returns {{name: string, imageUrl: string|null, isPinned: boolean}[]} sorted by name
 */
export const getCategories = () => {
  const videos = favoritesService.listAll();
  const overrides = readThumbnailOverrides();

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

  // Only honour a pick that still points at a picture inside the category.
  const pinnedByTag = new Map();
  ordered.forEach((name) => {
    const pick = overrides[name];
    if (pick && (candidatesByTag.get(name) || []).includes(pick)) {
      pinnedByTag.set(name, pick);
    }
  });

  const assigned = matchDistinctThumbnails(ordered, candidatesByTag, pinnedByTag);

  return ordered.map((name) => ({
    name,
    // Fall back to a shared image only when matching proved none is free —
    // showing the real (duplicated) thumbnail beats showing a blank tile.
    imageUrl: assigned.get(name) || candidatesByTag.get(name)?.[0] || null,
    isPinned: pinnedByTag.has(name),
  }));
};
