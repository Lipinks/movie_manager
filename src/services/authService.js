import * as storage from '../utils/storage';

/**
 * Google OAuth session management.
 *
 * The app uses Google Identity Services' implicit token-client flow, which
 * issues NO refresh token — access tokens simply expire (~1 hour). Previously
 * an expired token was only noticed when a Drive call failed with 401, at
 * which point the token was cleared from localStorage but the React tree kept
 * its stale copy in state. The UI therefore stayed on the app, every
 * subsequent Fetch/Sync failed, and the only way out was a manual sign-out and
 * sign-in.
 *
 * This module fixes that end to end:
 *   - the token is stored together with its expiry timestamp;
 *   - `ensureValidToken()` silently re-acquires a token before it expires,
 *     which GIS grants without any user interaction while the Google session
 *     is alive and consent has already been given;
 *   - `withAuth()` retries once against a freshly minted token if Drive still
 *     answers 401;
 *   - when re-acquisition genuinely needs the user, the session is ended and
 *     subscribers (App) are notified so the UI falls back to the login screen
 *     instead of silently failing.
 */

export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

/** Renew this long before the real expiry so in-flight calls never race it. */
const EXPIRY_SKEW_MS = 5 * 60 * 1000;

/** Give up waiting on Google rather than leaving a promise pending forever. */
const TOKEN_REQUEST_TIMEOUT_MS = 60 * 1000;

/** How long to wait for the async <script> in index.html to define window.google. */
const GIS_LOAD_TIMEOUT_MS = 15 * 1000;

export class AuthError extends Error {
  constructor(message, { code = 'auth_error', interactionRequired = false } = {}) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.interactionRequired = interactionRequired;
  }
}

let tokenClient = null;
let clientId = null;
/** Resolver for the single in-flight `requestAccessToken` call, if any. */
let pendingRequest = null;
/** De-dupes concurrent renewals so a burst of calls triggers one popup at most. */
let inFlightRequest = null;

const listeners = new Set();

/* ------------------------------------------------------------------ *
 * Token storage
 * ------------------------------------------------------------------ */

export const getAccessToken = () => storage.getRaw(storage.KEYS.ACCESS_TOKEN);

const getExpiresAt = () => Number(storage.getRaw(storage.KEYS.TOKEN_EXPIRY)) || 0;

/** True when a token exists at all — used to decide app vs. login screen. */
export const isSignedIn = () => Boolean(getAccessToken());

/** True when the stored token is present and not within the renewal window. */
export const hasFreshToken = () =>
  Boolean(getAccessToken()) && Date.now() < getExpiresAt() - EXPIRY_SKEW_MS;

const persistToken = (response) => {
  // `expires_in` is in seconds; default to a conservative hour if absent.
  const lifetimeMs = (Number(response.expires_in) || 3600) * 1000;
  storage.setRaw(storage.KEYS.ACCESS_TOKEN, response.access_token);
  storage.setRaw(storage.KEYS.TOKEN_EXPIRY, String(Date.now() + lifetimeMs));
};

const clearToken = () => {
  storage.removeItem(storage.KEYS.ACCESS_TOKEN);
  storage.removeItem(storage.KEYS.TOKEN_EXPIRY);
};

/* ------------------------------------------------------------------ *
 * Subscriptions — let React mirror the session without polling
 * ------------------------------------------------------------------ */

/**
 * @param {(token: string|null) => void} listener
 * @returns {() => void} unsubscribe
 */
export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const notify = () => {
  const token = getAccessToken();
  listeners.forEach((listener) => listener(token));
};

/** Drop the local session and tell the UI to show the login screen. */
export const endSession = () => {
  if (!getAccessToken()) return;
  clearToken();
  notify();
};

/* ------------------------------------------------------------------ *
 * Google Identity Services plumbing
 * ------------------------------------------------------------------ */

const gisReady = () => Boolean(window.google?.accounts?.oauth2);

/** index.html loads the GIS script with `async defer`, so wait for it. */
const waitForGis = () =>
  new Promise((resolve, reject) => {
    if (gisReady()) return resolve();

    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (gisReady()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - startedAt > GIS_LOAD_TIMEOUT_MS) {
        clearInterval(timer);
        reject(new AuthError('Google Identity Services failed to load.', { code: 'gis_unavailable' }));
      }
    }, 100);
  });

const settlePending = (settle, value) => {
  const request = pendingRequest;
  pendingRequest = null;
  request?.[settle](value);
};

const handleTokenResponse = (response) => {
  if (response?.error || !response?.access_token) {
    settlePending(
      'reject',
      new AuthError(response?.error_description || response?.error || 'Authorization failed.', {
        code: response?.error || 'token_error',
        interactionRequired: true,
      })
    );
    return;
  }

  persistToken(response);
  settlePending('resolve', response.access_token);
  notify();
};

const handleTokenError = (error) => {
  settlePending(
    'reject',
    new AuthError(error?.message || 'Google sign-in was dismissed.', {
      code: error?.type || 'popup_error',
      interactionRequired: true,
    })
  );
};

/**
 * Register the OAuth client id. Safe to call repeatedly; the underlying GIS
 * client is created lazily on first use so a slow script load never blocks
 * the first render.
 */
export const configure = (googleClientId) => {
  clientId = googleClientId;
};

const ensureClient = async () => {
  if (tokenClient) return tokenClient;
  if (!clientId) {
    throw new AuthError('Google client id has not been configured.', { code: 'not_configured' });
  }

  await waitForGis();
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_DRIVE_SCOPE,
    callback: handleTokenResponse,
    error_callback: handleTokenError,
  });
  return tokenClient;
};

/**
 * Ask Google for an access token.
 * @param {{interactive?: boolean}} options  `interactive` forces the account
 *        chooser / consent screen. When false GIS reuses the existing Google
 *        session and returns a token with no UI at all — this is what makes
 *        long sessions keep working.
 */
const requestToken = async ({ interactive = false } = {}) => {
  if (inFlightRequest) return inFlightRequest;

  inFlightRequest = (async () => {
    const client = await ensureClient();
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingRequest = null;
          reject(
            new AuthError('Timed out waiting for Google to authorize the app.', {
              code: 'timeout',
              interactionRequired: true,
            })
          );
        }, TOKEN_REQUEST_TIMEOUT_MS);

        pendingRequest = {
          resolve: (token) => {
            clearTimeout(timer);
            resolve(token);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        };

        // '' lets Google skip all UI when it already has a valid session.
        client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
      });
    } finally {
      inFlightRequest = null;
    }
  })();

  return inFlightRequest;
};

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/** Interactive sign-in, triggered by the login button. */
export const signIn = () => requestToken({ interactive: true });

/**
 * Clear the local session. The grant itself is intentionally left in place so
 * signing back in is a silent, one-click affair rather than a fresh consent.
 */
export const signOut = () => {
  window.google?.accounts?.id?.disableAutoSelect?.();
  endSession();
};

/**
 * Return a usable access token, renewing it silently when it is missing or
 * close to expiring.
 */
export const ensureValidToken = async () => {
  if (hasFreshToken()) return getAccessToken();
  return requestToken({ interactive: false });
};

const isUnauthorized = (error) => error?.status === 401 || error?.status === 403;

/**
 * Run a Drive API call with a guaranteed-fresh access token.
 *
 * On a 401/403 the token is renewed once and the call retried, which covers
 * tokens revoked server-side before their nominal expiry. If the token cannot
 * be renewed without the user, the session ends and subscribers move the UI
 * back to the login screen.
 *
 * @param {(token: string) => Promise<any>} apiCall
 */
export const withAuth = async (apiCall) => {
  let token;
  try {
    token = await ensureValidToken();
  } catch (error) {
    if (error?.interactionRequired) endSession();
    throw error;
  }

  try {
    return await apiCall(token);
  } catch (error) {
    if (!isUnauthorized(error)) throw error;

    let renewed;
    try {
      renewed = await requestToken({ interactive: false });
    } catch (renewError) {
      endSession();
      throw renewError;
    }

    try {
      return await apiCall(renewed);
    } catch (retryError) {
      if (isUnauthorized(retryError)) endSession();
      throw retryError;
    }
  }
};
