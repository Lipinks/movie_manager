/**
 * In-memory stand-in for the Google Drive endpoints the sync code calls, for
 * tests. Files hold parsed JSON, and every write bumps a fake modifiedTime the
 * way Drive does. Install with `global.fetch = jest.fn(drive.handle)`.
 */

/** jsdom 16 has no Blob.text(), so read blobs the old way. */
const readBlobText = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: '',
  json: async () => body,
  text: async () => JSON.stringify(body),
});

export const createFakeDrive = () => {
  const files = new Map();
  const requests = [];
  /** Names of files whose download or upload should fail with HTTP 500. */
  const failingNames = new Set();
  let clock = 0;
  let nextId = 1;
  let downloadGate = null;

  const stamp = () => new Date(Date.UTC(2026, 0, 1) + (clock += 1) * 1000).toISOString();
  const meta = (file) => ({ id: file.id, name: file.name, modifiedTime: file.modifiedTime });
  const byName = (name) => [...files.values()].find((file) => file.name === name);

  /** Create or replace a file, as another device would. */
  const write = (name, content) => {
    const existing = byName(name);
    if (existing) {
      existing.content = content;
      existing.modifiedTime = stamp();
      return existing;
    }
    const file = { id: `file${nextId++}`, name, content, modifiedTime: stamp() };
    files.set(file.id, file);
    return file;
  };

  const handle = async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);
    const method = options.method || 'GET';
    requests.push({ method, url });

    if (method === 'GET' && url.pathname === '/drive/v3/files') {
      return jsonResponse({ files: [...files.values()].map(meta) });
    }

    const download = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (method === 'GET' && download) {
      if (downloadGate) await downloadGate;
      const file = files.get(download[1]);
      if (!file) return jsonResponse({}, 404);
      if (failingNames.has(file.name)) return jsonResponse({ error: 'boom' }, 500);
      return jsonResponse(file.content);
    }

    const update = url.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
    if (method === 'PATCH' && update) {
      const file = files.get(update[1]);
      if (failingNames.has(file.name)) return jsonResponse({ error: 'boom' }, 500);
      file.content = JSON.parse(await readBlobText(options.body));
      file.modifiedTime = stamp();
      return jsonResponse(meta(file));
    }

    if (method === 'POST' && url.pathname === '/upload/drive/v3/files') {
      const { name } = JSON.parse(await readBlobText(options.body.get('metadata')));
      if (failingNames.has(name)) return jsonResponse({ error: 'boom' }, 500);
      const content = JSON.parse(await readBlobText(options.body.get('file')));
      return jsonResponse(meta(write(name, content)));
    }

    return jsonResponse({ error: `unexpected ${method} ${url.pathname}` }, 400);
  };

  return {
    handle,
    write,
    read: (name) => byName(name)?.content,
    failingNames,
    requests,
    downloads: () => requests.filter((r) => r.method === 'GET' && r.url.searchParams.get('alt') === 'media'),
    uploads: () => requests.filter((r) => r.method === 'PATCH' || r.method === 'POST'),
    resetRequests: () => {
      requests.length = 0;
    },
    /** Make downloads wait until the returned function is called. */
    holdDownloads: () => {
      let release;
      downloadGate = new Promise((resolve) => {
        release = resolve;
      });
      return () => {
        downloadGate = null;
        release();
      };
    },
  };
};
