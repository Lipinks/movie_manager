import * as storage from '../utils/storage';
import { normalize, buildIndex, search, videoMatches } from './searchService';

const seed = () => {
  storage.setItem(storage.KEYS.STARS, [
    { Name: 'Zoë Saldaña', Image_Link: 'z.jpg' },
    { Name: 'Amara Dawn', Image_Link: 'a.jpg' },
  ]);
  storage.setItem(storage.KEYS.FAVORITES, {
    'zoë saldaña': [
      { id: 1, name: 'Desert Road Trip', imageUrl: '1.jpg', url: 'https://example.test/1', tags: ['Travel'] },
      { id: 2, name: 'Night Drama', imageUrl: '2.jpg', url: 'https://example.test/2', tags: ['Drama'] },
    ],
    'amara dawn': [
      { id: 3, name: 'Drama at Dawn', imageUrl: '3.jpg', url: 'https://example.test/3', tags: ['Drama', 'Travel'] },
    ],
  });
  storage.setItem(storage.KEYS.TAGS, ['Drama', 'Travel', 'Comedy']);
  storage.setItem(storage.KEYS.UPDATES, [{ id: 9, name: 'Dawn News', url: 'https://news.example.test/', isVPN: true }]);
};

const titles = (groups, key) => groups.find((g) => g.key === key)?.items.map((item) => item.title) || [];

beforeEach(() => {
  Object.values(storage.KEYS).forEach((key) => storage.removeItem(key));
  sessionStorage.clear();
  seed();
});

it('ignores case and accents', () => {
  expect(normalize('  Zoë SALDAÑA ')).toBe('zoe saldana');
  expect(titles(search(buildIndex(), 'zoe'), 'stars')).toEqual(['Zoë Saldaña']);
});

it('matches every word across a video’s name, star and categories', () => {
  const groups = search(buildIndex(), 'drama zoe');
  expect(titles(groups, 'videos')).toEqual(['Night Drama']);
});

it('ranks names that start with the query first', () => {
  const groups = search(buildIndex(), 'drama');
  // "Drama at Dawn" starts with it; "Night Drama" only contains it.
  expect(titles(groups, 'videos')).toEqual(['Drama at Dawn', 'Night Drama']);
});

it('groups results and counts them, leaving out empty groups', () => {
  const groups = search(buildIndex(), 'dawn');
  expect(groups.map((g) => [g.key, g.total])).toEqual([
    ['stars', 1],
    ['videos', 1],
    ['updates', 1],
  ]);
});

it('finds categories with their video counts', () => {
  const [category] = search(buildIndex(), 'trav').find((g) => g.key === 'categories').items;
  expect(category).toMatchObject({ title: 'Travel', videoCount: 2 });
});

it('searches Gallery photos from folders opened this visit', () => {
  sessionStorage.setItem('galleryFolderId', 'root');
  sessionStorage.setItem(
    'galleryFolder_root',
    JSON.stringify({ folders: [{ id: 'f1', name: 'Holidays' }], images: [{ id: 'p1', name: 'beach.jpg' }] })
  );
  sessionStorage.setItem('galleryFolder_f1', JSON.stringify({ folders: [], images: [{ id: 'p2', name: 'mountain.jpg' }] }));

  const [photo] = search(buildIndex(), 'holidays').find((g) => g.key === 'gallery').items;
  expect(photo).toMatchObject({ title: 'mountain.jpg', folderName: 'Holidays' });
});

it('returns nothing for an empty query', () => {
  expect(search(buildIndex(), '   ')).toEqual([]);
});

it('lets the Videos page filter with the same matching', () => {
  const video = { name: 'Night Drama', starName: 'zoë saldaña', tags: ['Drama'] };
  expect(videoMatches(video, 'ZOE night')).toBe(true);
  expect(videoMatches(video, 'travel')).toBe(false);
  expect(videoMatches(video, '')).toBe(true);
});
