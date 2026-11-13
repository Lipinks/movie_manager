import * as storage from '../utils/storage';
import { deleteTag } from './tagService';

beforeEach(() => {
  Object.values(storage.KEYS).forEach((key) => storage.removeItem(key));
});

it('deleting a category removes it from videos and stars, and keeps both', () => {
  storage.setItem(storage.KEYS.TAGS, ['Drama', 'Travel']);
  storage.setItem(storage.KEYS.STARS, [
    { Name: 'Amara', Image_Link: 'a', Tags: ['Drama', 'Travel'] },
    { Name: 'Bea', Image_Link: 'b' },
  ]);
  storage.setItem(storage.KEYS.FAVORITES, { amara: [{ id: 1, name: 'Clip', tags: ['Drama'] }] });

  deleteTag('Drama');

  expect(storage.getItem(storage.KEYS.TAGS)).toEqual(['Travel']);
  expect(storage.getItem(storage.KEYS.STARS)).toEqual([
    { Name: 'Amara', Image_Link: 'a', Tags: ['Travel'] },
    { Name: 'Bea', Image_Link: 'b' },
  ]);
  expect(storage.getItem(storage.KEYS.FAVORITES).amara[0].tags).toEqual([]);
});
