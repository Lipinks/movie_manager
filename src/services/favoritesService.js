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
