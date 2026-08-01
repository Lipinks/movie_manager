import * as storage from '../utils/storage';
import { toStarKey } from '../utils/starName';

/**
 * The star roster itself (the `stars` key). Drive synchronisation of this data
 * lives in `driveSyncService`; this module only owns the local read/write and
 * the ordering rule the UI depends on.
 */

const byName = (a, b) => String(a.Name).localeCompare(String(b.Name), undefined, { sensitivity: 'base' });

/** Stars are always presented alphabetically; sort on a copy, never in place. */
export const sortByName = (stars) => [...stars].sort(byName);

/** The roster as stored, coerced to an array and sorted. */
export const getStars = () => {
  const stored = storage.getItem(storage.KEYS.STARS, []);
  return Array.isArray(stored) ? sortByName(stored) : [];
};

/** Persist the roster (sorted) and hand back exactly what was written. */
export const saveStars = (stars) => {
  const sorted = sortByName(Array.isArray(stars) ? stars : []);
  storage.setItem(storage.KEYS.STARS, sorted);
  return sorted;
};

/** Case-insensitive lookup within an already-loaded roster. */
export const findByName = (stars, name) =>
  stars.find((star) => toStarKey(star.Name) === toStarKey(name)) || null;

/** Case-insensitive existence check — guards duplicate star creation. */
export const exists = (stars, name) => Boolean(findByName(stars, name));
