import * as storage from '../utils/storage';
import { findFilesByName } from './driveService';
import { fetchFromDrive, syncToDrive } from './driveSyncService';

// Skip real Google auth: hand every Drive call a fixed token.
jest.mock('./authService', () => ({
  withAuth: (apiCall) => apiCall('test-token'),
}));

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: '',
  json: async () => body,
  text: async () => JSON.stringify(body),
});

/**
 * A minimal fake of the Drive endpoints the sync code uses.
 * @param {object[][]} pages     files.list result pages, in order
 * @param {object}     contents  file id -> JSON body served by ?alt=media
 * @param {string[]}   failing   file ids whose download returns HTTP 500
 */
const installFakeDrive = ({ pages = [[]], contents = {}, failing = [] } = {}) => {
  global.fetch = jest.fn(async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);
    const method = options.method || 'GET';

    if (url.pathname === '/drive/v3/files' && method === 'GET') {
      const index = Number(url.searchParams.get('pageToken') || 0);
      const nextPageToken = index + 1 < pages.length ? String(index + 1) : undefined;
      return jsonResponse({ files: pages[index], nextPageToken });
    }

    const media = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (media && url.searchParams.get('alt') === 'media') {
      const id = media[1];
      if (failing.includes(id)) return jsonResponse({ error: 'boom' }, 500);
      return id in contents ? jsonResponse(contents[id]) : jsonResponse({}, 404);
    }

    // Uploads (PATCH to an existing file, or a multipart POST creating one).
    return jsonResponse({ id: 'created' });
  });
};

const listCalls = () =>
  global.fetch.mock.calls
    .map(([url, options = {}]) => ({ url: new URL(url), options }))
    .filter(({ url, options }) => url.pathname === '/drive/v3/files' && !options.method);

beforeEach(() => {
  Object.values(storage.KEYS).forEach((key) => storage.removeItem(key));
});

afterEach(() => {
  delete global.fetch;
});

describe('findFilesByName', () => {
  it('asks Drive only for the named, non-trashed files', async () => {
    installFakeDrive({ pages: [[{ id: '1', name: 'star.json' }]] });

    await findFilesByName('tok', ['star.json', "it's.json"]);

    const [{ url, options }] = listCalls();
    expect(url.searchParams.get('q')).toBe("(name = 'star.json' or name = 'it\\'s.json') and trashed = false");
    expect(url.searchParams.get('orderBy')).toBe('modifiedTime desc');
    expect(options.headers.Authorization).toBe('Bearer tok');
  });

  it('follows nextPageToken until every page is read', async () => {
    installFakeDrive({
      pages: [[{ id: '1', name: 'star.json' }], [{ id: '2', name: 'tags.json' }]],
    });

    const files = await findFilesByName('tok', ['star.json', 'tags.json']);

    expect(files.map((f) => f.id)).toEqual(['1', '2']);
    expect(listCalls().map(({ url }) => url.searchParams.get('pageToken'))).toEqual([null, '1']);
  });
});

describe('fetchFromDrive', () => {
  it('keeps local data for documents that do not exist on Drive', async () => {
    storage.setItem(storage.KEYS.STARS, [{ Name: 'Local Star' }]);
    storage.setItem(storage.KEYS.FAVORITES, { 'local star': [{ id: 1, name: 'Clip' }] });
    storage.setItem(storage.KEYS.TAGS, ['old-tag']);
    installFakeDrive({
      pages: [[{ id: 't', name: 'tags.json' }]],
      contents: { t: ['drive-tag'] },
    });

    const stars = await fetchFromDrive();

    expect(stars).toEqual([{ Name: 'Local Star' }]);
    expect(storage.getItem(storage.KEYS.FAVORITES)).toEqual({ 'local star': [{ id: 1, name: 'Clip' }] });
    expect(storage.getItem(storage.KEYS.TAGS)).toEqual(['drive-tag']);
  });

  it('keeps local data when a download fails, and still applies the others', async () => {
    storage.setItem(storage.KEYS.FAVORITES, { a: [{ id: 1 }] });
    installFakeDrive({
      pages: [[{ id: 's', name: 'star.json' }, { id: 'f', name: 'favorites.json' }]],
      contents: { s: { stars: [{ Name: 'Drive Star' }] } },
      failing: ['f'],
    });

    const stars = await fetchFromDrive();

    expect(stars).toEqual([{ Name: 'Drive Star' }]);
    expect(storage.getItem(storage.KEYS.FAVORITES)).toEqual({ a: [{ id: 1 }] });
  });
});

describe('syncToDrive', () => {
  it('updates files that already exist instead of creating duplicates', async () => {
    storage.setItem(storage.KEYS.STARS, [{ Name: 'A' }]);
    installFakeDrive({ pages: [[{ id: 's1', name: 'star.json' }]] });

    await syncToDrive();

    const uploads = global.fetch.mock.calls.filter(([, options = {}]) => options.method);
    const patches = uploads.filter(([, options]) => options.method === 'PATCH');
    const creates = uploads.filter(([, options]) => options.method === 'POST');

    expect(patches).toHaveLength(1);
    expect(patches[0][0]).toContain('/upload/drive/v3/files/s1?uploadType=media');
    // The five documents Drive does not have yet are created.
    expect(creates).toHaveLength(5);
  });
});
