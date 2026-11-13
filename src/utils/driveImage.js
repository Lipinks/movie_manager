/**
 * URL of a screen-sized rendition of a Drive image, from Drive's thumbnail
 * service. A phone photo's original is often 3–8 MB; this is typically a few
 * hundred KB and looks the same on screen. The size is rounded to a few fixed
 * steps so the same picture always maps to the same URL, which the browser
 * caches.
 * @param {{thumbnailLink?: string}} image  a Drive file with thumbnailLink
 * @returns the URL, or null when Drive gave no resizable thumbnail
 */
export const viewerUrl = (image) => {
  if (!image?.thumbnailLink || !/=s\d+$/.test(image.thumbnailLink)) return null;
  const longestSide = Math.max(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1);
  const size = [1024, 1600, 2048].find((step) => step >= longestSide) || 2048;
  return image.thumbnailLink.replace(/=s\d+$/, `=s${size}`);
};
