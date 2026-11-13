import * as storage from '../utils/storage';
import * as authService from './authService';
import * as driveSyncService from './driveSyncService';

/**
 * Automatic Google Drive sync.
 *
 *  - Local edits are uploaded a few seconds after the last change, and at
 *    once when the tab is hidden, so switching away or closing the tab does
 *    not leave them behind. Only the files that changed are uploaded,
 *    usually in a single request straight to the remembered Drive file.
 *  - Drive is checked when the app opens and whenever the tab is shown again.
 *    Only files another device changed are downloaded (compared by Drive's
 *    `modifiedTime`), so a check with nothing new costs a single request.
 *  - Edits not yet uploaded are remembered across reloads (SYNC_PENDING) and
 *    are always uploaded before anything is downloaded, so a download can
 *    never overwrite them.
 *  - The first time a browser syncs, nothing is overwritten automatically
 *    unless that is safe: an empty browser takes Drive's copy, a browser that
 *    already matches Drive just starts tracking, and otherwise sync waits for
 *    the user to press Fetch or Sync once to say which copy wins.
 *
 * Conflicts between devices are not detected: as with the Sync button, the
 * most recent upload wins.
 *
 * Background work never shows Google's sign-in popup on its own: browsers
 * block popups that the user didn't click for. If the access token can't be
 * renewed silently, sync pauses until the user clicks the status indicator.
 */

const DEFAULTS = {
  /** Wait this long after the last edit before uploading. */
  pushDelayMs: 3000,
  /** Minimum gap between Drive checks triggered by returning to the tab. */
  pullIntervalMs: 60 * 1000,
  /** Back-off between upload retries after a failure. */
  retryDelaysMs: [15 * 1000, 60 * 1000, 5 * 60 * 1000],
};

let config = DEFAULTS;
let running = false;
let unsubscribeStorage = null;

let pushTimer = null;
let retryAttempt = 0;
/** Bumped on every local edit, to tell whether one happened during a download. */
let localRevision = 0;
/** Per-key edit counters, to tell whether a key was edited again mid-upload. */
const keyRevisions = new Map();
let lastPullAt = 0;
let lastSyncedAt = null;

let inFlight = false;
let lastError = null;
/** Background token renewal failed; waiting for the user to click resume. */
let authBlocked = false;
/** First sync found local data and Drive differ; waiting for Fetch or Sync. */
let needsChoice = false;

/** Serialises every sync operation so uploads and downloads never overlap. */
let queue = Promise.resolve();
const enqueue = (task) => {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
};

/* ------------------------------------------------------------------ *
 * Status, for the header indicator
 * ------------------------------------------------------------------ */

/**
 * @typedef {{state: 'off'|'saved'|'pending'|'syncing'|'error'|'paused'|'setup',
 *            lastSyncedAt: number|null, message: string|null}} SyncStatus
 */

let status = { state: 'off', lastSyncedAt: null, message: null };
const statusListeners = new Set();

/**
 * The synced keys edited here but not uploaded yet. Kept in localStorage so
 * they survive a reload, and so an upload sends only the files that changed.
 */
const readPending = () => {
  const raw = storage.getRaw(storage.KEYS.SYNC_PENDING);
  if (!raw) return new Set();
  try {
    const keys = JSON.parse(raw);
    if (Array.isArray(keys)) return new Set(keys.filter((key) => driveSyncService.SYNCED_KEYS.includes(key)));
  } catch {
    // Unreadable: fall through and upload everything to be safe.
  }
  // Also covers the earlier '1' flag, which didn't say which keys changed.
  return new Set(driveSyncService.SYNCED_KEYS);
};

const writePending = (keys) => {
  if (keys.size) storage.setRaw(storage.KEYS.SYNC_PENDING, JSON.stringify([...keys]));
  else storage.removeItem(storage.KEYS.SYNC_PENDING);
};

const clearPending = () => writePending(new Set());

const isDirty = () => readPending().size > 0;

const computeState = () => {
  if (!running) return 'off';
  if (inFlight) return 'syncing';
  if (needsChoice) return 'setup';
  if (authBlocked) return 'paused';
  if (lastError) return 'error';
  if (isDirty()) return 'pending';
  return 'saved';
};

const refreshStatus = () => {
  const next = {
    state: computeState(),
    lastSyncedAt,
    message: lastError?.message || null,
  };
  if (
    next.state === status.state &&
    next.lastSyncedAt === status.lastSyncedAt &&
    next.message === status.message
  ) {
    return;
  }
  status = next;
  statusListeners.forEach((listener) => listener(status));
};

/** @returns {SyncStatus} the same object until something changes (safe for useSyncExternalStore). */
export const getStatus = () => status;

/** @returns {() => void} unsubscribe */
export const subscribe = (listener) => {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
};

/** True while local edits are waiting to be uploaded. */
export const hasPendingChanges = () => isDirty();

/* ------------------------------------------------------------------ *
 * Remote changes, so pages can re-read their data
 * ------------------------------------------------------------------ */

const remoteListeners = new Set();

/**
 * Called after a download from Drive changed local data.
 * @param {(change: {stars: object[]|null, changedKeys: string[]}) => void} listener
 *        `stars` is the new roster when star.json changed, otherwise null
 * @returns {() => void} unsubscribe
 */
export const onRemoteChange = (listener) => {
  remoteListeners.add(listener);
  return () => remoteListeners.delete(listener);
};

const notifyRemoteChange = ({ stars, changedKeys }) => {
  const change = { stars: changedKeys.includes(storage.KEYS.STARS) ? stars : null, changedKeys };
  remoteListeners.forEach((listener) => listener(change));
};

/* ------------------------------------------------------------------ *
 * Sync operations
 * ------------------------------------------------------------------ */

const clearPushTimer = () => {
  clearTimeout(pushTimer);
  pushTimer = null;
};

const schedulePush = (delay) => {
  if (!running) return;
  clearPushTimer();
  pushTimer = setTimeout(() => {
    pushTimer = null;
    enqueue(() => push());
  }, delay);
};

const scheduleRetry = () => {
  const delays = config.retryDelaysMs;
  schedulePush(delays[Math.min(retryAttempt, delays.length - 1)]);
  retryAttempt += 1;
};

/**
 * Make sure Drive can be called. A click (userInitiated) may show Google's
 * popup, so withAuth handles it; background work only uses a token that is
 * still fresh or can be renewed without any UI.
 */
const ensureToken = async (userInitiated) => {
  if (userInitiated || authService.hasFreshToken()) {
    authBlocked = false;
    return true;
  }
  if (authBlocked) return false; // already tried; wait for the user

  try {
    await authService.ensureValidToken();
    authBlocked = false;
    return true;
  } catch {
    authBlocked = true;
    return false;
  }
};

const succeeded = () => {
  lastError = null;
  retryAttempt = 0;
  lastSyncedAt = Date.now();
};

/**
 * Upload local data. Background calls upload only the documents with pending
 * edits; the Sync button (userInitiated) uploads everything.
 */
const push = async ({ userInitiated = false } = {}) => {
  if (!running) return;
  clearPushTimer();

  const pending = readPending();
  if (!userInitiated) {
    if (needsChoice) return;
    // Never synced from this browser: the first-sync check decides what's safe.
    if (!driveSyncService.hasBaseline()) return pull();
    if (!pending.size) return;
  }
  if (!(await ensureToken(userInitiated))) {
    refreshStatus();
    return;
  }

  // Note each key's edit count now, to tell afterwards which were edited again.
  const uploading = new Map([...pending].map((key) => [key, keyRevisions.get(key) || 0]));
  inFlight = true;
  refreshStatus();
  try {
    await driveSyncService.syncToDrive(userInitiated ? {} : { keys: [...pending] });
    succeeded();
    needsChoice = false;

    const stillPending = readPending();
    uploading.forEach((revision, key) => {
      if ((keyRevisions.get(key) || 0) === revision) stillPending.delete(key);
    });
    writePending(stillPending);
    if (stillPending.size) schedulePush(config.pushDelayMs); // edited during the upload
  } catch (error) {
    lastError = error;
    scheduleRetry();
    if (userInitiated) throw error;
  } finally {
    inFlight = false;
    refreshStatus();
  }
};

/**
 * Bring in changes from Drive.
 * @param {{userInitiated?: boolean, force?: boolean}} options  force (the
 *        Fetch button) downloads and applies everything, replacing local data.
 * @returns the stars array now in effect, or null when nothing was applied
 */
const pull = async ({ userInitiated = false, force = false } = {}) => {
  if (!running) return null;

  const firstSync = !force && !driveSyncService.hasBaseline();
  if (!force) {
    if (needsChoice) return null;
    // Pending edits go up first; downloading now would overwrite them.
    if (!firstSync && isDirty()) {
      await push({ userInitiated });
      return null;
    }
  }
  if (!(await ensureToken(userInitiated))) {
    refreshStatus();
    return null;
  }

  const revision = localRevision;
  inFlight = true;
  refreshStatus();
  try {
    const entries = await driveSyncService.downloadFromDrive({ onlyChanged: !force && !firstSync });

    // The user edited something while the download was in flight. Keep that
    // edit rather than overwrite it; the scheduled upload takes it from here.
    if (!force && localRevision !== revision) return null;

    if (firstSync && !driveSyncService.isLocallyEmpty()) {
      const failure = entries.find((e) => e.outcome === 'failed');
      if (failure) throw failure.error;

      if (!driveSyncService.matchesLocal(entries)) {
        needsChoice = true;
        return null;
      }
      driveSyncService.markBaseline(entries);
      clearPending();
      succeeded();
      lastPullAt = Date.now();
      return null;
    }

    const result = driveSyncService.applyDownload(entries);
    if (force) {
      // Local data now mirrors Drive, so nothing is left to upload.
      clearPushTimer();
      clearPending();
      needsChoice = false;
    }

    if (result.failures.length) lastError = result.failures[0].error;
    else succeeded();
    lastPullAt = Date.now();

    if (result.changedKeys.length) notifyRemoteChange(result);
    if (userInitiated && result.starsError) throw result.starsError;
    return result.stars;
  } catch (error) {
    lastError = error;
    if (userInitiated) throw error;
    return null;
  } finally {
    inFlight = false;
    refreshStatus();
  }
};

/* ------------------------------------------------------------------ *
 * Triggers
 * ------------------------------------------------------------------ */

const handleStorageChange = (key, { fromRemote }) => {
  if (fromRemote || !driveSyncService.SYNCED_KEYS.includes(key)) return;
  localRevision += 1;
  keyRevisions.set(key, (keyRevisions.get(key) || 0) + 1);
  const pending = readPending();
  pending.add(key);
  writePending(pending);
  schedulePush(config.pushDelayMs);
  refreshStatus();
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    if (isDirty()) enqueue(() => push());
  } else if (Date.now() - lastPullAt >= config.pullIntervalMs) {
    enqueue(() => pull());
  }
};

const handleOnline = () => {
  if (isDirty()) enqueue(() => push());
};

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Start syncing automatically (call once signed in). Checks Drive right away.
 * @param {Partial<typeof DEFAULTS>} [options]  timing overrides, for tests
 */
export const start = (options = {}) => {
  if (running) return;
  config = { ...DEFAULTS, ...options };
  running = true;
  unsubscribeStorage = storage.subscribe(handleStorageChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('online', handleOnline);
  refreshStatus();
  enqueue(() => pull());
};

/** Stop syncing (on sign-out). Pending edits stay flagged and upload next time. */
export const stop = () => {
  if (!running) return;
  running = false;
  clearPushTimer();
  unsubscribeStorage?.();
  unsubscribeStorage = null;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('online', handleOnline);

  retryAttempt = 0;
  lastPullAt = 0;
  lastError = null;
  authBlocked = false;
  needsChoice = false;
  refreshStatus();
};

/** The Sync button: upload everything now, replacing Drive's copy. */
export const syncNow = () => enqueue(() => push({ userInitiated: true }));

/** The Fetch button: download everything now, replacing local data. Resolves to the stars. */
export const fetchNow = () => enqueue(() => pull({ userInitiated: true, force: true }));

/**
 * Retry after a failure or a paused sign-in (the status indicator's click).
 * Does nothing while the first sync is waiting for the user to choose Fetch
 * or Sync: resuming must never pick a side on their behalf.
 */
export const resume = () => {
  if (!running || needsChoice) return Promise.resolve();
  authBlocked = false;
  lastError = null;
  refreshStatus();
  return enqueue(() => (isDirty() ? push({ userInitiated: true }) : pull({ userInitiated: true })));
};

/** Resolves once every queued sync operation has finished. */
export const whenIdle = () => queue;
