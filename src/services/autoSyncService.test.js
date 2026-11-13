import * as storage from '../utils/storage';
import * as authService from './authService';
import * as autoSync from './autoSyncService';
import { createFakeDrive } from './testing/fakeDrive';

jest.mock('./authService', () => ({
  withAuth: (apiCall) => apiCall('test-token'),
  hasFreshToken: jest.fn(),
  ensureValidToken: jest.fn(),
}));

/** No waiting, so tests run in milliseconds. Retries are slow unless a test needs them. */
const FAST = { pushDelayMs: 0, pullIntervalMs: 0, retryDelaysMs: [60 * 1000] };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Let pending timers fire, then wait for every queued sync to finish. */
const settle = async () => {
  await sleep(10);
  await autoSync.whenIdle();
  await sleep(0);
  await autoSync.whenIdle();
};

const setVisibility = (state, { dispatch = true } = {}) => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  if (dispatch) document.dispatchEvent(new Event('visibilitychange'));
};

const state = () => autoSync.getStatus().state;
const localTags = () => storage.getItem(storage.KEYS.TAGS);

let drive;

/** A browser that already matches Drive: auto-sync starts tracking without changing anything. */
const startInSync = async (options = FAST) => {
  storage.setItem(storage.KEYS.TAGS, ['a']);
  drive.write('tags.json', ['a']);
  autoSync.start(options);
  await settle();
  drive.resetRequests();
};

beforeEach(() => {
  Object.values(storage.KEYS).forEach((key) => storage.removeItem(key));
  drive = createFakeDrive();
  global.fetch = jest.fn(drive.handle);
  authService.hasFreshToken.mockReturnValue(true);
  authService.ensureValidToken.mockResolvedValue('test-token');
});

afterEach(async () => {
  autoSync.stop();
  await autoSync.whenIdle();
  setVisibility('visible', { dispatch: false });
  delete global.fetch;
});

describe('first sync on a browser', () => {
  it("takes Drive's copy when this browser has no data", async () => {
    drive.write('star.json', [{ Name: 'Drive Star' }]);
    drive.write('tags.json', ['drive-tag']);
    const changes = [];
    const unsubscribe = autoSync.onRemoteChange((change) => changes.push(change));

    autoSync.start(FAST);
    await settle();
    unsubscribe();

    expect(storage.getItem(storage.KEYS.STARS)).toEqual([{ Name: 'Drive Star' }]);
    expect(localTags()).toEqual(['drive-tag']);
    expect(changes[0].stars).toEqual([{ Name: 'Drive Star' }]);
    expect(drive.uploads()).toHaveLength(0);
    expect(state()).toBe('saved');
  });

  it('just starts tracking when this browser already matches Drive', async () => {
    await startInSync();

    expect(state()).toBe('saved');
    expect(storage.getItem(storage.KEYS.DRIVE_VERSIONS)).not.toBeNull();
  });

  it('overwrites nothing when the data differs, until the user presses Sync', async () => {
    storage.setItem(storage.KEYS.TAGS, ['local']);
    drive.write('tags.json', ['drive']);

    autoSync.start(FAST);
    await settle();
    expect(state()).toBe('setup');

    // Edits keep working locally, but are not uploaded over Drive's copy.
    storage.setItem(storage.KEYS.TAGS, ['local', 'more']);
    await settle();
    expect(drive.uploads()).toHaveLength(0);
    expect(drive.read('tags.json')).toEqual(['drive']);
    expect(localTags()).toEqual(['local', 'more']);

    // Clicking the indicator must not pick a side either.
    await autoSync.resume();
    expect(drive.uploads()).toHaveLength(0);

    await autoSync.syncNow();
    expect(drive.read('tags.json')).toEqual(['local', 'more']);
    expect(state()).toBe('saved');
  });

  it("uses Drive's copy when the user presses Fetch", async () => {
    storage.setItem(storage.KEYS.TAGS, ['local']);
    drive.write('tags.json', ['drive']);
    autoSync.start(FAST);
    await settle();

    await autoSync.fetchNow();

    expect(localTags()).toEqual(['drive']);
    expect(autoSync.hasPendingChanges()).toBe(false);
    expect(state()).toBe('saved');
  });
});

describe('uploading local edits', () => {
  it('uploads an edit shortly after it is made', async () => {
    await startInSync();

    storage.setItem(storage.KEYS.TAGS, ['a', 'b']);
    expect(state()).toBe('pending');
    await settle();

    expect(drive.read('tags.json')).toEqual(['a', 'b']);
    expect(autoSync.hasPendingChanges()).toBe(false);
    expect(state()).toBe('saved');
  });

  it('uploads only the edited file, straight to it, as compact JSON', async () => {
    await startInSync();
    storage.setItem(storage.KEYS.STARS, []); // an unrelated, unchanged document stays put
    await settle();
    drive.resetRequests();

    storage.setItem(storage.KEYS.TAGS, ['a', 'b']);
    await settle();

    // One request: no lookup first, and no other file re-sent.
    expect(drive.requests).toHaveLength(1);
    expect(drive.requests[0].method).toBe('PATCH');
    expect(drive.requests[0].body).toBe('["a","b"]');
  });

  it('writes a new file when the remembered one was deleted on Drive', async () => {
    await startInSync();
    drive.remove('tags.json');

    storage.setItem(storage.KEYS.TAGS, ['a', 'b']);
    await settle();

    expect(drive.read('tags.json')).toEqual(['a', 'b']);
    expect(state()).toBe('saved');
  });

  it('uploads straight away when the tab is hidden', async () => {
    await startInSync({ ...FAST, pushDelayMs: 60 * 1000 });

    storage.setItem(storage.KEYS.TAGS, ['a', 'b']);
    await sleep(10);
    expect(drive.read('tags.json')).toEqual(['a']);

    setVisibility('hidden');
    await settle();
    expect(drive.read('tags.json')).toEqual(['a', 'b']);
  });

  it('uploads edits left over from the last visit before checking Drive', async () => {
    // Previous visit: synced once, then edited without the upload finishing.
    storage.setItem(storage.KEYS.TAGS, ['mine']);
    storage.setItem(storage.KEYS.DRIVE_VERSIONS, {});
    storage.setRaw(storage.KEYS.SYNC_PENDING, '1');
    drive.write('tags.json', ['older']);

    autoSync.start(FAST);
    await settle();

    expect(localTags()).toEqual(['mine']);
    expect(drive.read('tags.json')).toEqual(['mine']);
  });

  it('uploads only the documents left pending by the last visit', async () => {
    storage.setItem(storage.KEYS.TAGS, ['mine']);
    storage.setItem(storage.KEYS.YOUTUBE, ['https://www.youtube.com/embed/x']);
    storage.setItem(storage.KEYS.DRIVE_VERSIONS, {});
    storage.setRaw(storage.KEYS.SYNC_PENDING, JSON.stringify([storage.KEYS.TAGS]));

    autoSync.start(FAST);
    await settle();

    expect(drive.read('tags.json')).toEqual(['mine']);
    expect(drive.read('youtube.json')).toBeUndefined();
    expect(autoSync.hasPendingChanges()).toBe(false);
  });

  it('keeps edits and retries after a failed upload', async () => {
    await startInSync({ ...FAST, retryDelaysMs: [30] });
    drive.failingNames.add('tags.json');

    storage.setItem(storage.KEYS.TAGS, ['a', 'b']);
    await settle();
    expect(state()).toBe('error');
    expect(autoSync.hasPendingChanges()).toBe(true);

    drive.failingNames.clear();
    await sleep(60);
    await settle();
    expect(drive.read('tags.json')).toEqual(['a', 'b']);
    expect(state()).toBe('saved');
  });

  it('pauses instead of showing a sign-in popup, and resumes on click', async () => {
    await startInSync();
    authService.hasFreshToken.mockReturnValue(false);
    authService.ensureValidToken.mockRejectedValue(new Error('popup blocked'));

    storage.setItem(storage.KEYS.TAGS, ['a', 'b']);
    await settle();
    expect(state()).toBe('paused');
    expect(drive.read('tags.json')).toEqual(['a']);

    // Further edits don't keep retrying the renewal.
    storage.setItem(storage.KEYS.TAGS, ['a', 'b', 'c']);
    await settle();
    expect(authService.ensureValidToken).toHaveBeenCalledTimes(1);

    await autoSync.resume();
    expect(drive.read('tags.json')).toEqual(['a', 'b', 'c']);
    expect(state()).toBe('saved');
  });
});

describe('downloading changes from Drive', () => {
  it('downloads only the files another device changed', async () => {
    await startInSync();
    drive.write('tags.json', ['a', 'from-phone']);
    const changes = [];
    const unsubscribe = autoSync.onRemoteChange((change) => changes.push(change));

    setVisibility('visible');
    await settle();
    unsubscribe();

    expect(drive.downloads()).toHaveLength(1);
    expect(localTags()).toEqual(['a', 'from-phone']);
    expect(changes).toEqual([{ stars: null, changedKeys: [storage.KEYS.TAGS] }]);
    // A downloaded copy is not uploaded straight back.
    expect(drive.uploads()).toHaveLength(0);
  });

  it("checks with a single request and doesn't re-download its own upload", async () => {
    await startInSync();
    storage.setItem(storage.KEYS.TAGS, ['a', 'b']);
    await settle();
    drive.resetRequests();

    setVisibility('visible');
    await settle();

    expect(drive.requests).toHaveLength(1);
    expect(drive.downloads()).toHaveLength(0);
  });

  it('keeps an edit made while a download is in flight', async () => {
    await startInSync();
    drive.write('tags.json', ['remote']);
    const release = drive.holdDownloads();

    setVisibility('visible');
    await sleep(10);
    storage.setItem(storage.KEYS.TAGS, ['local-edit']);
    release();
    await settle();

    expect(localTags()).toEqual(['local-edit']);
    expect(drive.read('tags.json')).toEqual(['local-edit']);
  });
});
