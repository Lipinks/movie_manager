import * as storage from '../utils/storage';

export const getAccessToken = () => storage.getRaw(storage.KEYS.ACCESS_TOKEN);

export const clearTokens = () => {
  storage.removeItem(storage.KEYS.ACCESS_TOKEN);
};

/**
 * Runs a Drive API call with the currently stored access token.
 *
 * The app uses Google Identity Services' implicit token-client flow, which
 * issues NO refresh token — so there is nothing to silently refresh (the old
 * refresh implementation also required a client secret, which must never live
 * in frontend code). Instead, when a call fails with 401 (expired/invalid
 * token) we clear the stored token so the app falls back to the login screen
 * and the user re-consents.
 */
export const withTokenRefresh = async (apiCall) => {
  try {
    return await apiCall(getAccessToken());
  } catch (error) {
    if (error.status === 401 || error.message?.includes('401')) {
      clearTokens();
    }
    throw error;
  }
};
