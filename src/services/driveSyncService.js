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
const FILE_FIELDS = 'id,name,modifiedTime,trashed';

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
 * Known Drive files
 *
 * The id and `modifiedTime` of each file, as last downloaded or uploaded by
 * this browser. The id lets an upload write straight to its file without
 * looking it up first. Comparing `modifiedTime` with Drive's shows which
 * files another device changed, so an automatic check only downloads those.
 * The key's absence means this browser has never completed a sync.
 * ------------------------------------------------------------------ */

const readKnownFiles = () => {
  const stored = storage.getItem(storage.KEYS.DRIVE_VERSIONS, {});
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};

  const known = {};
  Object.entries(stored).forEach(([name, entry]) => {
    // Entries written before ids were remembered hold just the modifiedTime.
    known[name] = typeof entry === 'string' ? { modifiedTime: entry } : entry || {};
  });
  return known;
};

/** Record the given files. Always writes, so it also marks a first sync as done. */
const rememberFiles = (files) => {
  const next = readKnownFiles();
  files.forEach((file) => {
    if (file?.name && file.id && file.modifiedTime && !file.trashed) {
      next[file.name] = { id: file.id, modifiedTime: file.modifiedTime };
    }
  });
  storage.setItem(storage.KEYS.DRIVE_VERSIONS, next);
};

/** True once this browser has completed at least one sync with Drive. */
export const hasBaseline = () => storage.getItem(storage.KEYS.DRIVE_VERSIONS, null) !== null;

/* ------------------------------------------------------------------ *
 * Upload
 * ------------------------------------------------------------------ */

/**
 * Compact JSON. Indentation only helped a person reading the file on Drive,
 * and made every upload about a third bigger.
 */
const toJsonBlob = (data) => new Blob([JSON.stringify(data)], { type: 'application/json' });

const updateFile = (token, id, data) =>
  driveJson(`${UPLOAD_API}/files/${id}?uploadType=media&fields=${FILE_FIELDS}`, {
    token,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: toJsonBlob(data),
  });

const createFile = (token, fileName, data) => {
  const metadata = { name: fileName, mimeType: 'application/json' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', toJsonBlob(data));

  return driveJson(`${UPLOAD_API}/files?uploadType=multipart&fields=${FILE_FIELDS}`, {
    token,
    method: 'POST',
    body: form,
  });
};

/**
 * Write one document: straight to its remembered file when there is one,
 * otherwise to the file of that name on Drive, otherwise to a new file.
 * @param {() => Promise<object[]>} findExisting  shared, at-most-once lookup
 * @returns the written file's { id, name, modifiedTime, trashed }
 */
const uploadDocument = async (token, doc, knownId, findExisting) => {
  const data = readLocal(doc);

  if (knownId) {
    try {
      const written = await updateFile(token, knownId, data);
      if (!written.trashed) return written;
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    // The remembered file was deleted or trashed on Drive: use the live one.
  }

  const existing = (await findExisting()).find((file) => file.name === doc.file && file.id !== knownId);
  return existing ? updateFile(token, existing.id, data) : createFile(token, doc.file, data);
};

/**
 * Push documents up to Drive.
 * @param {{keys?: string[]}} [options]  only upload the documents stored under
 *        these localStorage keys; omit to upload everything (the Sync button)
 */
export const syncToDrive = async ({ keys } = {}) => {
  const docs = keys ? DOCUMENTS.filter((doc) => keys.includes(doc.key)) : DOCUMENTS;
  if (!docs.length) return;

  await withAuth(async (token) => {
    const known = readKnownFiles();

    // Only documents without a remembered file need a lookup, and they share one.
    let lookup = null;
    const findExisting = () => {
      if (!lookup) lookup = findFilesByName(token, docs.map((doc) => doc.file));
      return lookup;
    };

    const results = await Promise.allSettled(
      docs.map((doc) => uploadDocument(token, doc, known[doc.file]?.id, findExisting))
    );

    // Record what did upload even if something else failed, so the next
    // check doesn't download this browser's own changes back.
    rememberFiles(results.filter((r) => r.status === 'fulfilled').map((r) => r.value));

    const failure = results.find((r) => r.status === 'rejected');
    if (failure) throw failure.reason;
  });
};

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
    const known = onlyChanged ? readKnownFiles() : {};

    return Promise.all(
      DOCUMENTS.map(async (doc) => {
        const file = files.find((f) => f.name === doc.file);
        if (!file) return { doc, outcome: 'absent' };

        // Same file at the same version as last time. A different id means
        // another device wrote a newer copy, so that one is downloaded.
        const last = known[doc.file];
        if (onlyChanged && last && file.modifiedTime === last.modifiedTime && (!last.id || last.id === file.id)) {
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

  rememberFiles(entries.filter((e) => e.outcome === 'downloaded' && e.value != null).map((e) => e.file));

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

/** Record downloaded files without changing any data: browser and Drive agree. */
export const markBaseline = (entries) => {
  rememberFiles(entries.filter((e) => e.outcome === 'downloaded').map((e) => e.file));
};
