/**
 * A star's name doubles as its identity: it is the route param, and — lowercased
 * — the key of its entry in the favorites map. Casing therefore has to be
 * normalised through one place, otherwise a video saved from the star page
 * (`Test Star`) becomes invisible to the videos page (`test star`).
 */

/** Canonical key used for favorites lookups and route matching. */
export const toStarKey = (name) => String(name ?? '').trim().toLowerCase();

/** Human-facing rendering of a stored (lowercased) star key. */
export const toDisplayName = (name) => {
  const trimmed = String(name ?? '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : '';
};

/** Case-insensitive equality for two star names. */
export const isSameStar = (a, b) => toStarKey(a) === toStarKey(b);
