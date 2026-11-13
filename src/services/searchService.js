import * as starsService from './starsService';
import * as favoritesService from './favoritesService';
import * as tagService from './tagService';
import * as updatesService from './updatesService';
import { toStarKey, toDisplayName } from '../utils/starName';
import { getHostname } from '../utils/url';

/**
 * Search across the whole app: stars, videos, categories, Updates sites and
 * Gallery photos.
 *
 * Everything except the Gallery is already in memory, so searching is a
 * plain scan; at a few thousand videos it takes well under a millisecond per
 * keystroke and needs no index or network. Gallery photos live only in
 * Drive, so only the folders opened this visit (the Gallery's session cache)
 * are searched.
 */

/** Case- and accent-insensitive form used for all matching. */
export const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const wordsOf = (query) => normalize(query).split(/\s+/).filter(Boolean);

/** Searchable text of a video: its name, its star and its categories. */
const videoText = (video) => normalize([video.name, toDisplayName(video.starName), ...(video.tags || [])].join(' '));

/**
 * True when a video matches every word of `query`, in any of its fields.
 * Used by the Videos page for "See all" results.
 */
export const videoMatches = (video, query) => {
  const words = wordsOf(query);
  if (!words.length) return true;
  const text = videoText(video);
  return words.every((word) => text.includes(word));
};

/* ------------------------------------------------------------------ *
 * Index
 * ------------------------------------------------------------------ */

/** Photos from the Gallery folders opened this visit (see gallery.js's cache). */
const readGalleryCache = () => {
  const rootId = sessionStorage.getItem('galleryFolderId');
  const folders = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith('galleryFolder_')) continue;
    try {
      folders.push({ id: key.slice('galleryFolder_'.length), ...JSON.parse(sessionStorage.getItem(key)) });
    } catch {
      // A damaged cache entry just isn't searched.
    }
  }

  const folderNames = new Map([[rootId, 'Gallery']]);
  folders.forEach((folder) => (folder.folders || []).forEach((sub) => folderNames.set(sub.id, sub.name)));

  return folders.flatMap((folder) =>
    (folder.images || []).map((image) => ({ ...image, folderName: folderNames.get(folder.id) || 'Gallery' }))
  );
};

const entry = (id, title, fields, payload) => ({
  id,
  title,
  titleText: normalize(title),
  text: normalize([title, ...fields].join(' ')),
  ...payload,
});

/**
 * Snapshot of everything searchable. Built when the search panel opens, so it
 * always reflects the latest edits and anything auto-sync brought in.
 */
export const buildIndex = () => {
  const videos = favoritesService.listAll();

  const videoCountByStar = new Map();
  const videoCountByTag = new Map();
  videos.forEach((video) => {
    videoCountByStar.set(video.starName, (videoCountByStar.get(video.starName) || 0) + 1);
    (video.tags || []).forEach((tag) => videoCountByTag.set(tag, (videoCountByTag.get(tag) || 0) + 1));
  });

  const tagNames = new Set([...tagService.getTags(), ...videoCountByTag.keys()]);

  return {
    stars: starsService.getStars().map((star, i) =>
      entry(`star-${i}`, star.Name, star.Tags || [], {
        imageUrl: star.Image_Link,
        starKey: toStarKey(star.Name),
        videoCount: videoCountByStar.get(toStarKey(star.Name)) || 0,
      })
    ),
    videos: videos.map((video) =>
      entry(`video-${video.starName}-${video.id}`, video.name, [toDisplayName(video.starName), ...(video.tags || [])], {
        imageUrl: video.imageUrl,
        url: video.url,
        starName: toDisplayName(video.starName),
        tags: video.tags || [],
      })
    ),
    categories: [...tagNames].map((tag) =>
      entry(`category-${tag}`, tag, [], { videoCount: videoCountByTag.get(tag) || 0 })
    ),
    updates: updatesService.getSites().map((site) =>
      entry(`site-${site.id}`, site.name, [getHostname(site.url)], {
        url: site.url,
        hostname: getHostname(site.url),
        isVPN: Boolean(site.isVPN),
      })
    ),
    gallery: readGalleryCache().map((image) =>
      entry(`photo-${image.id}`, image.name, [image.folderName], { image, folderName: image.folderName })
    ),
  };
};

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

export const GROUPS = [
  { key: 'stars', label: 'Stars' },
  { key: 'videos', label: 'Videos' },
  { key: 'categories', label: 'Categories' },
  { key: 'updates', label: 'Updates' },
  { key: 'gallery', label: 'Gallery' },
];

/** Higher is better: the name starting with the query beats a match elsewhere. */
const score = (item, phrase, words) => {
  if (item.titleText.startsWith(phrase)) return 3;
  const titleWords = item.titleText.split(/\s+/);
  if (words.every((word) => titleWords.some((titleWord) => titleWord.startsWith(word)))) return 2;
  if (words.every((word) => item.titleText.includes(word))) return 1;
  return 0; // matched through another field (a star, a tag, a folder)
};

/**
 * @param {ReturnType<typeof buildIndex>} index
 * @param {string} query  every word must appear somewhere in the item
 * @returns {{key: string, label: string, total: number, items: object[]}[]}
 *          groups with at least one match, each sorted best first
 */
export const search = (index, query) => {
  const phrase = normalize(query);
  const words = wordsOf(query);
  if (!words.length) return [];

  return GROUPS.map(({ key, label }) => {
    const items = (index[key] || [])
      .filter((item) => words.every((word) => item.text.includes(word)))
      .map((item) => ({ item, rank: score(item, phrase, words) }))
      .sort((a, b) => b.rank - a.rank || a.item.title.localeCompare(b.item.title, undefined, { sensitivity: 'base' }))
      .map(({ item }) => item);
    return { key, label, total: items.length, items };
  }).filter((group) => group.total > 0);
};
