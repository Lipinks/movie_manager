import { driveJson, findFilesByName, DRIVE_API, UPLOAD_API } from './driveService';
import { withAuth } from './authService';
import * as starsService from './starsService';
import * as storage from '../utils/storage';

/**
 * Two-way synchronisation of the app's JSON documents with Google Drive.
 *
 * Used directly by the manual Fetch / Sync buttons, and by `autoSyncService`
 * for automatic syncing.
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

/** The localStorage keys whose changes need uploading to Drive. */
export const SYNCED_KEYS = DOCUMENTS.map((doc) => doc.key);

/** Ask Drive to return these fields for every file it writes. */
const FILE_FIELDS = 'id,name,modifiedTime';

/** The local value of a document, in the shape that is uploaded. */
const readLocal = (doc) => {
  const value = storage.getItem(doc.key, doc.empty);
  return doc === STARS ? starsService.sortByName(normalizeStars(value)) : value;
};

const isEmptyValue = (value) => {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') return Object.keys(value).length === 0;
  return !value;
};

/* ------------------------------------------------------------------ *
 * Drive versions
 *
 * The `modifiedTime` of each file, as last downloaded or uploaded by this
 * browser. Comparing it with Drive's current `modifiedTime` shows which files
 * another device has changed, so an automatic check only downloads those.
 * The key's absence means this browser has never completed a sync.
 * ------------------------------------------------------------------ */

const readKnownVersions = () => {
  const stored = storage.getItem(storage.KEYS.DRIVE_VERSIONS, {});
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
};

/** Record the given files' versions. Always writes, so it also marks a first sync as done. */
const rememberVersions = (files) => {
  const next = { ...readKnownVersions() };
  files.forEach((file) => {
    if (file?.name && file.modifiedTime) next[file.name] = file.modifiedTime;
  });
  storage.setItem(storage.KEYS.DRIVE_VERSIONS, next);
};

/** True once this browser has completed at least one sync with Drive. */
export const hasBaseline = () => storage.getItem(storage.KEYS.DRIVE_VERSIONS, null) !== null;

/* ------------------------------------------------------------------ *
 * Upload
 * ------------------------------------------------------------------ */

/**
 * Create or overwrite a JSON file on Drive. `existingFile` (from a single
 * lookup) is passed in so callers can look up once and save many.
 * @returns the written file's { id, name, modifiedTime }
 */
const saveFile = async (token, fileName, data, existingFile) => {
  const fileContent = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

  if (existingFile) {
    return driveJson(`${UPLOAD_API}/files/${existingFile.id}?uploadType=media&fields=${FILE_FIELDS}`, {
      token,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: fileContent,
    });
  }

  const metadata = { name: fileName, mimeType: 'application/json' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', fileContent);

  return driveJson(`${UPLOAD_API}/files?uploadType=multipart&fields=${FILE_FIELDS}`, {
    token,
    method: 'POST',
    body: form,
  });
};

/** Push every locally stored document up to Drive. */
export const syncToDrive = async () =>
  withAuth(async (token) => {
    // Look the files up once, then upload all of them in parallel.
    const files = await findFilesByName(token, FILE_NAMES);
    const findFile = (name) => files.find((f) => f.name === name);

    const results = await Promise.allSettled(
      DOCUMENTS.map((doc) => saveFile(token, doc.file, readLocal(doc), findFile(doc.file)))
    );

    // Record what did upload even if something else failed, so the next
    // check doesn't download this browser's own changes back.
    rememberVersions(results.filter((r) => r.status === 'fulfilled').map((r) => r.value));

    const failure = results.find((r) => r.status === 'rejected');
    if (failure) throw failure.reason;
  });

/* ------------------------------------------------------------------ *
 * Download
 * ------------------------------------------------------------------ */

/**
 * Download documents from Drive WITHOUT touching local data, so the caller
 * can decide whether to apply them (see `applyDownload`).
 *
 * @param {{onlyChanged?: boolean}} [options]  onlyChanged skips files whose
 *        Drive copy is the version this browser last downloaded or uploaded.
 * @returns {Promise<Array<{doc, outcome: 'downloaded'|'unchanged'|'absent'|'failed', file?, value?, error?}>>}
 */
export const downloadFromDrive = async ({ onlyChanged = false } = {}) =>
  withAuth(async (token) => {
    const files = await findFilesByName(token, FILE_NAMES);
    const known = onlyChanged ? readKnownVersions() : {};

    return Promise.all(
      DOCUMENTS.map(async (doc) => {
        const file = files.find((f) => f.name === doc.file);
        if (!file) return { doc, outcome: 'absent' };
        if (onlyChanged && file.modifiedTime && known[doc.file] === file.modifiedTime) {
          return { doc, outcome: 'unchanged', file };
        }

        // A failure on one file must NOT stop (or wipe) the others.
        try {
          const value = await driveJson(`${DRIVE_API}/files/${file.id}?alt=media`, { token });
          return { doc, outcome: 'downloaded', file, value };
        } catch (error) {
          return { doc, outcome: 'failed', file, error };
        }
      })
    );
  });

/**
 * Write downloaded documents into localStorage.
 *
 * A document is only overwritten when Drive actually had a copy. A failed
 * download, or a file that does not exist on Drive (for example a Drive
 * account that predates that file), leaves the local copy untouched instead
 * of replacing it with an empty value.
 *
 * @returns {{stars: object[], changedKeys: string[], failures: {file: string, error: Error}[], starsError: Error|null}}
 *          `stars` is the roster now in effect, downloaded or not.
 */
export const applyDownload = (entries) => {
  const changedKeys = [];
  const failures = [];
  let downloadedStars = null;

  entries.forEach(({ doc, outcome, value, error }) => {
    if (outcome === 'failed') {
      failures.push({ file: doc.file, error });
      return;
    }
    if (outcome !== 'downloaded' || value == null) return;

    if (doc === STARS) {
      downloadedStars = starsService.saveStars(normalizeStars(value), { fromRemote: true });
    } else {
      storage.setItem(doc.key, value, { fromRemote: true });
    }
    changedKeys.push(doc.key);
  });

  rememberVersions(entries.filter((e) => e.outcome === 'downloaded' && e.value != null).map((e) => e.file));

  return {
    stars: downloadedStars ?? normalizeStars(storage.getItem(STARS.key, STARS.empty)),
    changedKeys,
    failures,
    starsError: failures.find((f) => f.file === STARS.file)?.error ?? null,
  };
};

/**
 * Pull every document down from Drive into localStorage (the Fetch button).
 * @returns the stars array now in effect (the caller drives React state with it).
 * @throws  when star.json itself could not be downloaded
 */
export const fetchFromDrive = async () => {
  const result = applyDownload(await downloadFromDrive());
  if (result.starsError) throw result.starsError;
  return result.stars;
};

/* ------------------------------------------------------------------ *
 * First sync on a browser
 * ------------------------------------------------------------------ */

/** True when this browser holds no data at all, so downloading cannot lose anything. */
export const isLocallyEmpty = () => DOCUMENTS.every((doc) => isEmptyValue(readLocal(doc)));

/**
 * True when every downloaded document matches the local copy exactly, i.e.
 * the browser and Drive already agree. A file missing from Drive matches only
 * an empty local value. Entries must come from a full (not onlyChanged) download.
 */
export const matchesLocal = (entries) =>
  entries.every(({ doc, outcome, value }) => {
    const local = readLocal(doc);
    if (outcome === 'absent') return isEmptyValue(local);
    if (outcome !== 'downloaded') return false;

    const remote = doc === STARS ? starsService.sortByName(normalizeStars(value)) : value;
    return JSON.stringify(remote) === JSON.stringify(local);
  });

/** Record downloaded versions without changing any data: browser and Drive agree. */
export const markBaseline = (entries) => {
  rememberVersions(entries.filter((e) => e.outcome === 'downloaded').map((e) => e.file));
};
