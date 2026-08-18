import * as storage from '../utils/storage';
import { normalizeUrl, isHttpUrl } from '../utils/url';

/**
 * The saved website list behind the Updates page.
 *
 * Validation lives here rather than in the component so it is pure and
 * testable, and so the stored shape can only ever contain usable http(s) URLs.
 */

/** Monotonic id — Date.now() alone collides on rapid successive adds. */
let lastIssuedId = 0;
const createId = () => {
  const now = Date.now();
  lastIssuedId = now > lastIssuedId ? now : lastIssuedId + 1;
  return lastIssuedId;
};

/** Every saved site, in the order they were added. Always a fresh array. */
export const getSites = () => {
  const stored = storage.getItem(storage.KEYS.UPDATES, []);
  if (!Array.isArray(stored)) return [];

  // Defensive: drop anything that is not a usable entry, so one bad record
  // (hand-edited, or pulled from Drive) cannot break the whole page.
  return stored.filter((site) => site && typeof site === 'object' && isHttpUrl(site.url));
};

/**
 * Add a website.
 * @param {{name: string, url: string, isVPN: boolean}} input
 * @returns {{sites: object[], error: string|null}}
 */
export const addSite = ({ name, url, isVPN }) => {
  const sites = getSites();
  // The name is stored exactly as typed apart from trimming — never reformatted.
  const trimmedName = String(name ?? '').trim();
  const normalizedUrl = normalizeUrl(url);

  if (!trimmedName) return { sites, error: 'Enter a name for the website.' };
  if (!String(url ?? '').trim()) return { sites, error: 'Enter the website link.' };
  if (!normalizedUrl) {
    return { sites, error: 'That does not look like a valid website link (http:// or https://).' };
  }
  if (sites.some((site) => site.url === normalizedUrl)) {
    return { sites, error: 'That website is already saved.' };
  }

  const next = [...sites, { id: createId(), name: trimmedName, url: normalizedUrl, isVPN: Boolean(isVPN) }];
  storage.setItem(storage.KEYS.UPDATES, next);
  return { sites: next, error: null };
};

/** Remove one website by id. Returns the remaining list. */
export const removeSite = (id) => {
  const next = getSites().filter((site) => site.id !== id);
  storage.setItem(storage.KEYS.UPDATES, next);
  return next;
};
