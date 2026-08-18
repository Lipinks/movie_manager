/**
 * URL helpers for user-entered links.
 *
 * Anything a user types is treated as untrusted: a value is only ever rendered
 * as a live link once it has been confirmed to be http(s), which keeps a pasted
 * `javascript:` value inert.
 */

/**
 * `new URL()` alone is far too permissive for validating typed input: the
 * WHATWG parser percent-encodes rather than rejects, so `https://not a url`
 * happily parses with the hostname `not%20a%20url`. The host therefore has to
 * be sanity-checked separately.
 */
const isUsableHostname = (host) => {
  // Anything outside this set means the parser had to escape something —
  // spaces, quotes, and other junk all arrive here percent-encoded.
  if (!host || !/^[a-z0-9.-]+$/i.test(host)) return false;

  if (host === 'localhost') return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true; // IPv4

  // Otherwise require dot-separated labels ending in an alphabetic TLD.
  return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(host);
};

/** Parse to a URL, or null when the value is not a usable http(s) address. */
const parse = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return isUsableHostname(url.hostname) ? url : null;
  } catch {
    return null;
  }
};

/** True when the value is a safe, well-formed http(s) URL. */
export const isHttpUrl = (value) => parse(value) !== null;

/**
 * Make a best-effort URL out of what the user typed, so `example.com` works
 * without them having to remember the scheme.
 * @returns the normalised URL string, or '' when it cannot be salvaged.
 */
export const normalizeUrl = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';

  const direct = parse(trimmed);
  if (direct) return direct.href;

  // No scheme (or an unusable one) — try again assuming https.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    const prefixed = parse(`https://${trimmed}`);
    if (prefixed) return prefixed.href;
  }

  return '';
};

/** Hostname of an http(s) URL, or '' when it is not one. */
export const getHostname = (value) => parse(value)?.hostname || '';

/**
 * Google's favicon service for a site. Used because it resolves icons that a
 * naive `/favicon.ico` guess misses, and it is already within the app's
 * existing Google trust boundary.
 * @returns the icon URL, or null when the input is not a usable address.
 */
export const getFaviconUrl = (value, size = 64) => {
  const host = getHostname(value);
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}` : null;
};
