import { driveFetch, driveJson, findFilesByName, DRIVE_API, UPLOAD_API } from './driveService';
import { withAuth } from './authService';
import * as storage from '../utils/storage';

/**
 * Two-way synchronisation of the app's JSON documents with Google Drive.
 *
 * (Formerly `starService` — the name understated its job: stars are only one
 * of the files it moves.)
 */

/**
 * Coerce whatever is in storage/Drive into a plain stars array, tolerating the
 * legacy `{ stars: [...] }` wrapper shape.
 */
const normalizeStars = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.stars)) return raw.stars;
  return [];
};

/** Each synced document: its Drive file name, its localStorage key, and its empty value. */
const STARS = { file: 'star.json', key: storage.KEYS.STARS, empty: [] };
const OTHER_DOCUMENTS = [
  { file: 'favorites.json', key: storage.KEYS.FAVORITES, empty: {} },
  { file: 'tags.json', key: storage.KEYS.TAGS, empty: [] },
  { file: 'youtube.json', key: storage.KEYS.YOUTUBE, empty: [] },
  { file: 'categoryThumbnails.json', key: storage.KEYS.CATEGORY_THUMBNAILS, empty: {} },
  { file: 'updates.json', key: storage.KEYS.UPDATES, empty: [] },
];
const DOCUMENTS = [STARS, ...OTHER_DOCUMENTS];
const FILE_NAMES = DOCUMENTS.map((doc) => doc.file);

/** The local value of a document, in the shape that is uploaded. */
const readLocal = (doc) => {
  const value = storage.getItem(doc.key, doc.empty);
  return doc === STARS ? normalizeStars(value) : value;
};

/**
 * Create or overwrite a JSON file on Drive. `existingFile` (from a single
 * lookup) is passed in so callers can look up once and save many.
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
    // Look the files up once, then upload all of them in parallel.
    const files = await findFilesByName(token, FILE_NAMES);
    const findFile = (name) => files.find((f) => f.name === name);

    await Promise.all(DOCUMENTS.map((doc) => saveFile(token, doc.file, readLocal(doc), findFile(doc.file))));
  });

/**
 * Pull every document down from Drive into localStorage.
 *
 * A document is only overwritten locally when Drive actually has it. A failed
 * download, or a file that does not exist on Drive (for example a Drive
 * account that predates that file), leaves the local copy untouched instead
 * of replacing it with an empty value.
 *
 * @returns the stars array now in effect (the caller drives React state with it).
 */
export const fetchFromDrive = async () =>
  withAuth(async (token) => {
    const files = await findFilesByName(token, FILE_NAMES);

    // Fetch all in parallel; a failure on one must NOT wipe the others' local data.
    const [starsResult, ...otherResults] = await Promise.allSettled(
      DOCUMENTS.map((doc) => fetchFile(token, doc.file, files))
    );

    otherResults.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value != null) {
        storage.setItem(OTHER_DOCUMENTS[i].key, result.value);
      }
    });

    if (starsResult.status === 'rejected') {
      throw starsResult.reason;
    }
    // No star.json on Drive: keep the local roster rather than emptying it.
    return normalizeStars(starsResult.value ?? storage.getItem(STARS.key, STARS.empty));
  });
