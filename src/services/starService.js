import * as driveService from './driveService';
import { driveFetch, DRIVE_API, UPLOAD_API } from './driveService';
import { withTokenRefresh } from './authService';
import * as storage from '../utils/storage';

const FILES = {
  STAR: 'star.json',
  FAVORITES: 'favorites.json',
  TAGS: 'tags.json',
  YOUTUBE: 'youtube.json',
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

  const response = await driveFetch(`${DRIVE_API}/files/${file.id}?alt=media`, { token });
  return response.json();
};

export const saveStarFile = async (accessToken) => {
  return withTokenRefresh(async (token) => {
    // List once, then upload all four files in parallel.
    const files = await driveService.listFiles(token);
    const findFile = (name) => files.find((f) => f.name === name);

    const payloads = [
      [FILES.STAR, normalizeStars(storage.getItem(storage.KEYS.STARS, []))],
      [FILES.FAVORITES, storage.getItem(storage.KEYS.FAVORITES, {})],
      [FILES.TAGS, storage.getItem(storage.KEYS.TAGS, [])],
      [FILES.YOUTUBE, storage.getItem(storage.KEYS.YOUTUBE, [])],
    ];

    await Promise.all(payloads.map(([name, data]) => saveFile(token, name, data, findFile(name))));
  });
};

export const fetchStarFile = async (accessToken) => {
  return withTokenRefresh(async (token) => {
    const files = await driveService.listFiles(token);

    // Fetch all four; a failure on one must NOT wipe the others' local data.
    const [starsResult, favoritesResult, tagsResult, youtubeResult] = await Promise.allSettled([
      fetchFile(token, FILES.STAR, files),
      fetchFile(token, FILES.FAVORITES, files),
      fetchFile(token, FILES.TAGS, files),
      fetchFile(token, FILES.YOUTUBE, files),
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

    if (starsResult.status === 'rejected') {
      throw starsResult.reason;
    }
    return normalizeStars(starsResult.value);
  });
};
