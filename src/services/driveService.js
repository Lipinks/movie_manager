export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/**
 * Centralized Google Drive fetch: injects the Bearer auth header and turns any
 * non-OK response into a thrown Error carrying the HTTP status. Every Drive
 * call in the app should go through this instead of hand-rolling headers.
 *
 * @param {string} url                full request URL
 * @param {object} opts               { token, ...fetchOptions }
 * @returns {Promise<Response>}        the raw Response (caller decides json/blob)
 */
export const driveFetch = async (url, { token, headers, ...options } = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
  });

  // 204 (No Content) is a success for DELETE.
  if (!response.ok && response.status !== 204) {
    const text = await response.text().catch(() => '');
    const error = new Error(`Drive request failed: ${response.status} ${response.statusText} ${text}`.trim());
    error.status = response.status;
    throw error;
  }

  return response;
};

export const listFiles = async (token) => {
  const response = await driveFetch(`${DRIVE_API}/files?fields=files(id,name,modifiedTime)`, { token });
  const data = await response.json();
  return data.files || [];
};
