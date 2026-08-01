import * as storage from '../utils/storage';

/**
 * The saved YouTube embed list.
 *
 * URL parsing lives here rather than in the component so it is pure,
 * reusable and independently testable.
 */

/** Pull the embeddable URL out of a raw paste (iframe snippet, watch URL, …). */
export const extractEmbedUrl = (input) => {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('<iframe')) {
    return trimmed.match(/src=["']([^"']+)["']/)?.[1] || trimmed;
  }

  if (trimmed.includes('youtube.com/watch?v=')) {
    const videoId = trimmed.match(/v=([^&]+)/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : trimmed;
  }

  if (trimmed.includes('youtu.be/')) {
    const videoId = trimmed.split('youtu.be/')[1]?.split(/[?&#]/)[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : trimmed;
  }

  return trimmed;
};

export const isValidEmbedUrl = (url) => String(url ?? '').includes('youtube.com/embed/');

/** The eleven-character video id inside an embed URL, for thumbnails. */
export const getVideoId = (url) => String(url ?? '').match(/embed\/([^?/]+)/)?.[1] || null;

export const getVideos = () => {
  const stored = storage.getItem(storage.KEYS.YOUTUBE, []);
  return Array.isArray(stored) ? stored : [];
};

/**
 * Add a video.
 * @returns {{videos: string[], error: string|null}}
 */
export const addVideo = (rawInput) => {
  const videos = getVideos();
  const url = extractEmbedUrl(rawInput);

  if (!url) return { videos, error: 'Enter a YouTube URL first.' };
  if (!isValidEmbedUrl(url)) return { videos, error: 'That does not look like a valid YouTube URL.' };
  if (videos.includes(url)) return { videos, error: 'This video is already in your collection.' };

  const next = [...videos, url];
  storage.setItem(storage.KEYS.YOUTUBE, next);
  return { videos: next, error: null };
};

/** Remove the video at `index`; returns the new list. */
export const removeVideoAt = (index) => {
  const next = getVideos().filter((_, i) => i !== index);
  storage.setItem(storage.KEYS.YOUTUBE, next);
  return next;
};
