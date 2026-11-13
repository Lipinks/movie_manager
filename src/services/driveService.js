export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/**
 * Centralized Google Drive fetch: injects the Bearer auth header and turns any
 * non-OK response into a thrown Error carrying the HTTP status. Every Drive
 * call in the app should go through this instead of hand-rolling headers.
 *
 * @param {string} url                full request URL
 * @param {object} opts               { token, ...fetchOptions }
 * @returns {Promise<Response>}        the raw Response (caller decides json/blob)
 */
export const driveFetch = async (url, { token, headers, ...options } = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
  });

  // 204 (No Content) is a success for DELETE.
  if (!response.ok && response.status !== 204) {
    const text = await response.text().catch(() => '');
    const error = new Error(`Drive request failed: ${response.status} ${response.statusText} ${text}`.trim());
    error.status = response.status;
    throw error;
  }

  return response;
};

/** driveFetch + JSON decoding, for the many endpoints that return JSON. */
export const driveJson = async (url, options) => {
  const response = await driveFetch(url, options);
  return response.json();
};

/** Escape a value for use inside a single-quoted Drive query string literal. */
const escapeQueryValue = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

/**
 * Find the user's non-trashed files with any of the given exact names.
 *
 * This replaced an unfiltered `files.list` call. Drive returns only 100 files
 * per page by default (and includes trashed files), so once the Drive held
 * more than that, the app's own JSON files could fall off the first page and
 * look "missing" — which made Fetch overwrite local data with empty values and
 * Sync upload duplicates instead of updating the existing files.
 *
 * Results are newest-modified first, so when duplicates exist (e.g. left over
 * from that bug) `files.find(byName)` picks the most recent copy.
 *
 * @param {string}   token
 * @param {string[]} names  exact file names to look for
 * @returns {Promise<{id: string, name: string, modifiedTime: string}[]>}
 */
export const findFilesByName = async (token, names) => {
  if (!names.length) return [];

  const nameClause = names.map((name) => `name = '${escapeQueryValue(name)}'`).join(' or ');
  const params = new URLSearchParams({
    q: `(${nameClause}) and trashed = false`,
    fields: 'nextPageToken,files(id,name,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '1000',
  });

  const files = [];
  let pageToken = null;
  do {
    if (pageToken) params.set('pageToken', pageToken);
    const data = await driveJson(`${DRIVE_API}/files?${params}`, { token });
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return files;
};
