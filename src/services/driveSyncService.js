import { driveFetch, driveJson, listFiles, DRIVE_API, UPLOAD_API } from './driveService';
import { withAuth } from './authService';
import * as storage from '../utils/storage';

/**
 * Two-way synchronisation of the app's four JSON documents with Google Drive.
 *
 * (Formerly `starService` — the name understated its job: stars are only one
 * of the four files it moves.)
 */

const FILES = {
  STAR: 'star.json',
  FAVORITES: 'favorites.json',
  TAGS: 'tags.json',
  YOUTUBE: 'youtube.json',
  CATEGORY_THUMBNAILS: 'categoryThumbnails.json',
  UPDATES: 'updates.json',
};

/**
 * Coerce whatever is in storage/Drive into a plain stars array, tolerating the
 * legacy `{ stars: [...] }` wrapper shape.
 */
const normalizeStars = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.stars)) return raw.stars;
  return [];
};

/**
 * Create or overwrite a JSON file on Drive. `existingFile` (from a single
 * listFiles call) is passed in so callers can list once and save many.
 */
const saveFile = async (token, fileName, data, existingFile) => {
  const fileContent = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

  if (existingFile) {
    await driveFetch(`${UPLOAD_API}/files/${existingFile.id}?uploadType=media`, {
      token,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: fileContent,
    });
    return;
  }

  const metadata = { name: fileName, mimeType: 'application/json' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', fileContent);

  await driveFetch(`${UPLOAD_API}/files?uploadType=multipart`, {
    token,
    method: 'POST',
    body: form,
  });
};

/**
 * Fetch a JSON file's contents by name.
 * @returns the parsed contents, or null when the file does not exist.
 * @throws  on network / HTTP errors so callers can avoid clobbering local data.
 */
const fetchFile = async (token, fileName, files) => {
  const file = files.find((f) => f.name === fileName);
  if (!file) return null;
  return driveJson(`${DRIVE_API}/files/${file.id}?alt=media`, { token });
};

/** Push every locally stored document up to Drive. */
export const syncToDrive = async () =>
  withAuth(async (token) => {
    // List once, then upload all four files in parallel.
    const files = await listFiles(token);
    const findFile = (name) => files.find((f) => f.name === name);

    const payloads = [
      [FILES.STAR, normalizeStars(storage.getItem(storage.KEYS.STARS, []))],
      [FILES.FAVORITES, storage.getItem(storage.KEYS.FAVORITES, {})],
      [FILES.TAGS, storage.getItem(storage.KEYS.TAGS, [])],
      [FILES.YOUTUBE, storage.getItem(storage.KEYS.YOUTUBE, [])],
      [FILES.CATEGORY_THUMBNAILS, storage.getItem(storage.KEYS.CATEGORY_THUMBNAILS, {})],
      [FILES.UPDATES, storage.getItem(storage.KEYS.UPDATES, [])],
    ];

    await Promise.all(payloads.map(([name, data]) => saveFile(token, name, data, findFile(name))));
  });

/**
 * Pull every document down from Drive into localStorage.
 * @returns the fetched stars array (the caller drives React state with it).
 */
export const fetchFromDrive = async () =>
  withAuth(async (token) => {
    const files = await listFiles(token);

    // Fetch all six; a failure on one must NOT wipe the others' local data.
    const [starsResult, favoritesResult, tagsResult, youtubeResult, coversResult, updatesResult] =
      await Promise.allSettled([
        fetchFile(token, FILES.STAR, files),
        fetchFile(token, FILES.FAVORITES, files),
        fetchFile(token, FILES.TAGS, files),
        fetchFile(token, FILES.YOUTUBE, files),
        fetchFile(token, FILES.CATEGORY_THUMBNAILS, files),
        fetchFile(token, FILES.UPDATES, files),
      ]);

    // Only overwrite a localStorage key when its fetch actually succeeded.
    // A rejected fetch (transient network/HTTP error) leaves existing data intact.
    if (favoritesResult.status === 'fulfilled') {
      storage.setItem(storage.KEYS.FAVORITES, favoritesResult.value || {});
    }
    if (tagsResult.status === 'fulfilled') {
      storage.setItem(storage.KEYS.TAGS, tagsResult.value || []);
    }
    if (youtubeResult.status === 'fulfilled') {
      storage.setItem(storage.KEYS.YOUTUBE, youtubeResult.value || []);
    }
    // These two files are newer than the others, so a Drive account that
    // predates them simply has no copy. `null` there means "absent", not
    // "empty" — writing a blank value would wipe data saved before the first
    // sync that included them.
    if (coversResult.status === 'fulfilled' && coversResult.value) {
      storage.setItem(storage.KEYS.CATEGORY_THUMBNAILS, coversResult.value);
    }
    if (updatesResult.status === 'fulfilled' && updatesResult.value) {
      storage.setItem(storage.KEYS.UPDATES, updatesResult.value);
    }

    if (starsResult.status === 'rejected') {
      throw starsResult.reason;
    }
    return normalizeStars(starsResult.value);
  });
