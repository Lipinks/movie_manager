import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import * as storage from '../../utils/storage';
import StarDetails from './StarDetails';

const tagsOfVideo = (name) =>
  storage.getItem(storage.KEYS.FAVORITES)['amara dawn'].find((video) => video.name === name).tags;

const chipsOnCard = (container, name) =>
  [...container.querySelectorAll('.video-card')]
    .find((card) => card.textContent.includes(name))
    .querySelectorAll('.video-tag');

const Page = () => {
  const [stars, setStars] = useState([{ Name: 'Amara Dawn', Image_Link: 'a.jpg', Tags: ['Drama'] }]);
  return <StarDetails stars={stars} onStarsUpdate={setStars} />;
};

beforeEach(() => {
  Object.values(storage.KEYS).forEach((key) => storage.removeItem(key));
  storage.setItem(storage.KEYS.TAGS, ['Drama', 'Travel', 'Music']);
  storage.setItem(storage.KEYS.FAVORITES, {
    'amara dawn': [
      { id: 1, name: 'Desert Road Trip', imageUrl: '1.jpg', url: 'https://example.test/1', tags: ['Drama', 'Music'] },
      { id: 2, name: 'Night Walk', imageUrl: '2.jpg', url: 'https://example.test/2', tags: [] },
    ],
  });
});

it("adds and removes a star's tags on all of that star's videos", () => {
  const { container } = render(
    <MemoryRouter initialEntries={['/star/amara%20dawn']}>
      <Routes>
        <Route path="/star/:starName" element={<Page />} />
      </Routes>
    </MemoryRouter>
  );

  fireEvent.click(screen.getByRole('button', { name: /Edit Star/ }));
  expect(screen.getByText(/all 2 of Amara Dawn's videos/)).toBeInTheDocument();

  fireEvent.click(screen.getByText('Travel', { selector: '.tag-editor-tag.available' }));
  fireEvent.click(screen.getByText('Drama', { selector: '.tag-editor-tag.selected' }));
  fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

  // Saved: Travel added everywhere, Drama removed, other tags kept.
  expect(tagsOfVideo('Desert Road Trip')).toEqual(['Music', 'Travel']);
  expect(tagsOfVideo('Night Walk')).toEqual(['Travel']);
  // And the page shows it straight away.
  expect([...chipsOnCard(container, 'Desert Road Trip')].map((chip) => chip.textContent)).toEqual(['Music', 'Travel']);
});
