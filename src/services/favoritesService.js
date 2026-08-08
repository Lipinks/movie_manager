import * as storage from '../utils/storage';
import { toStarKey } from '../utils/starName';
import { nowInIST } from '../utils/dateUtils';

/**
 * Single owner of the favorites (videos) store.
 *
 * On disk the shape is `{ [starKey]: Video[] }`. Previously every caller
 * (StarDetails, VideosPage, StarManager) re-implemented "read the map, splice
 * my star's array, write it back" — each with its own casing rules, and each
 * mutating the object handed out by the storage cache. Everything now goes
 * through these helpers, which always build new objects before persisting.
 */

/** Monotonic id generator — Date.now() alone collides on rapid successive adds. */
let lastIssuedId = 0;
const createId = () => {
  const now = Date.now();
  lastIssuedId = now > lastIssuedId ? now : lastIssuedId + 1;
  return lastIssuedId;
};

const readMap = () => {
  const raw = storage.getItem(storage.KEYS.FAVORITES, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
};

const readList = (starKey) => {
  const list = readMap()[starKey];
  return Array.isArray(list) ? list : [];
};

/** Persist one star's list, dropping the key entirely when it empties out. */
const writeList = (starKey, list) => {
  const next = { ...readMap() };
  if (list.length) next[starKey] = list;
  else delete next[starKey];
  storage.setItem(storage.KEYS.FAVORITES, next);
};

/** The whole map, as stored. Read-only — do not mutate. */
export const getAll = () => readMap();

/** Videos belonging to one star, each stamped with its `starName` key. */
export const listForStar = (starName) => {
  const key = toStarKey(starName);
  return readList(key).map((video) => ({ ...video, starName: key }));
};

/** Every video across every star, flattened and stamped with `starName`. */
export const listAll = () =>
  Object.entries(readMap()).flatMap(([key, list]) =>
    (Array.isArray(list) ? list : []).map((video) => ({ ...video, starName: key }))
  );

/**
 * Append a video to a star.
 * @returns the stored record, stamped with `starName`.
 */
export const add = (starName, video) => {
  const key = toStarKey(starName);
  const { starName: _ignored, ...fields } = video;
  const record = {
    ...fields,
    id: createId(),
    tags: Array.isArray(video.tags) ? video.tags : [],
    creation: nowInIST(),
  };

  writeList(key, [...readList(key), record]);
  return { ...record, starName: key };
};

/**
 * Patch an existing video in place.
 * @returns the updated record stamped with `starName`, or null when not found.
 */
export const update = (starName, id, patch) => {
  const key = toStarKey(starName);
  const list = readList(key);
  if (!list.some((video) => video.id === id)) return null;

  const { starName: _ignored, ...fields } = patch;
  const merged = { ...list.find((video) => video.id === id), ...fields, modification: nowInIST() };

  writeList(key, list.map((video) => (video.id === id ? merged : video)));
  return { ...merged, starName: key };
};

/** Remove a single video from a star. */
export const remove = (starName, id) => {
  const key = toStarKey(starName);
  writeList(key, readList(key).filter((video) => video.id !== id));
};

/** Remove every video belonging to a star (used when the star itself is deleted). */
export const removeStar = (starName) => {
  writeList(toStarKey(starName), []);
};

/* ------------------------------------------------------------------ *
 * Tag membership
 *
 * A tag is metadata *about* a video, so these operations only ever rewrite
 * a video's `tags` array — never its other fields, and never the video
 * itself. They also deliberately do not stamp `modification`: re-filing a
 * video under a category is not an edit of the video's own content, and
 * stamping it would reshuffle the "sort by modified time" view.
 *
 * Each helper rewrites the whole map in a single storage write, so a bulk
 * change across many stars cannot be left half-applied.
 * ------------------------------------------------------------------ */

const hasTag = (video, tag) => (Array.isArray(video.tags) ? video.tags : []).includes(tag);

/** Rebuild every star's list through `transform`, persisting once. */
const rewriteAllVideos = (transform) => {
  const current = readMap();
  const next = {};

  Object.entries(current).forEach(([starKey, list]) => {
    next[starKey] = (Array.isArray(list) ? list : []).map((video) => transform(video, starKey));
  });

  storage.setItem(storage.KEYS.FAVORITES, next);
};

/**
 * Tag the given videos with `tag`, leaving their existing tags untouched.
 * Videos that already carry the tag are skipped, so it cannot be duplicated.
 *
 * @param {{starName: string, id: number}[]} videoRefs
 * @param {string} tag
 */
export const addTagToVideos = (videoRefs, tag) => {
  const wanted = new Set(videoRefs.map((ref) => `${toStarKey(ref.starName)}::${ref.id}`));
  if (!wanted.size) return;

  rewriteAllVideos((video, starKey) => {
    if (!wanted.has(`${starKey}::${video.id}`) || hasTag(video, tag)) return video;
    return { ...video, tags: [...(Array.isArray(video.tags) ? video.tags : []), tag] };
  });
};

/** Un-tag a single video. The video and its other tags are left intact. */
export const removeTagFromVideo = (starName, id, tag) => {
  const key = toStarKey(starName);

  rewriteAllVideos((video, starKey) => {
    if (starKey !== key || video.id !== id || !hasTag(video, tag)) return video;
    return { ...video, tags: video.tags.filter((existing) => existing !== tag) };
  });
};

/**
 * Strip `tag` from every video that carries it. Used when a category is
 * deleted — no video is removed, only the association.
 */
export const removeTagEverywhere = (tag) => {
  rewriteAllVideos((video) => {
    if (!hasTag(video, tag)) return video;
    return { ...video, tags: video.tags.filter((existing) => existing !== tag) };
  });
};
