import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as storage from '../../utils/storage';
import VideosPage from './VideosPage';

/** 120 videos for one star; even ones tagged "even", odd ones "odd". */
const seedVideos = () => {
  const videos = Array.from({ length: 120 }, (_, i) => ({
    id: i + 1,
    name: `Video ${i + 1}`,
    imageUrl: `https://example.test/${i + 1}.jpg`,
    url: `https://example.test/watch/${i + 1}`,
    tags: [i % 2 === 0 ? 'even' : 'odd'],
  }));
  storage.setItem(storage.KEYS.STARS, [{ Name: 'Test Star', Image_Link: '' }]);
  storage.setItem(storage.KEYS.FAVORITES, { 'test star': videos });
  storage.setItem(storage.KEYS.TAGS, ['even', 'odd']);
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/videos']}>
      <VideosPage starName="" />
    </MemoryRouter>
  );

const cardCount = (container) => container.querySelectorAll('.video-card').length;

beforeEach(() => {
  Object.values(storage.KEYS).forEach((key) => storage.removeItem(key));
  seedVideos();
});

afterEach(() => {
  delete global.IntersectionObserver;
});

it('renders 50 videos at first and 50 more on "Show more"', () => {
  const { container } = renderPage();
  expect(cardCount(container)).toBe(50);

  fireEvent.click(screen.getByRole('button', { name: 'Show more (70 left)' }));
  expect(cardCount(container)).toBe(100);

  fireEvent.click(screen.getByRole('button', { name: 'Show more (20 left)' }));
  expect(cardCount(container)).toBe(120);
  expect(screen.queryByRole('button', { name: /Show more/ })).toBeNull();
});

it('loads the next 50 by itself when the end of the list nears the screen', () => {
  let notify;
  global.IntersectionObserver = class {
    constructor(callback) {
      notify = callback;
    }
    observe() {}
    disconnect() {}
  };

  const { container } = renderPage();
  act(() => notify([{ isIntersecting: true }]));

  expect(cardCount(container)).toBe(100);
});

describe('clicking a video card', () => {
  const firstCard = (container) => container.querySelector('.video-card');
  let open;

  beforeEach(() => {
    open = jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  it.each([
    ['the picture', '.card-image img'],
    ['the video name', '.video-name'],
    ['the empty space beside the name and star', '.card-content'],
    ['the space around the tags', '.video-tags-container'],
  ])('opens the video from %s', (_, selector) => {
    const { container } = renderPage();

    fireEvent.click(firstCard(container).querySelector(selector));

    expect(open).toHaveBeenCalledWith('https://example.test/watch/1', '_blank', 'noopener,noreferrer');
  });

  it('follows the star link instead of opening the video', () => {
    const { container } = renderPage();
    fireEvent.click(firstCard(container).querySelector('.star-name'));
    expect(open).not.toHaveBeenCalled();
  });

  it('filters by a tag instead of opening the video', () => {
    const { container } = renderPage();
    fireEvent.click(firstCard(container).querySelector('.video-tag'));
    expect(open).not.toHaveBeenCalled();
    expect(firstCard(container).querySelector('.video-tag')).toHaveClass('highlighted');
  });

  it('edits instead of opening the video', () => {
    const { container } = renderPage();
    fireEvent.click(firstCard(container).querySelector('.edit-btn svg'));
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Edit Video' })).toBeInTheDocument();
  });
});

describe('"See all" from the site search (?q=)', () => {
  const renderWithQuery = (query) =>
    render(
      <MemoryRouter initialEntries={[`/videos?q=${encodeURIComponent(query)}`]}>
        <VideosPage starName="" />
      </MemoryRouter>
    );

  it('shows only matching videos, and says what it is filtering by', () => {
    // Every word must appear: "11" is in "Video 11" and "Video 110"–"Video 119".
    const { container } = renderWithQuery('video 11');
    expect(cardCount(container)).toBe(11);
    expect(screen.getByText(/Videos matching/)).toHaveTextContent('Videos matching “video 11” (11)');
  });

  it('goes back to every video when the filter is cleared', () => {
    const { container } = renderWithQuery('video 11');
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(cardCount(container)).toBe(50);
    expect(screen.queryByText(/Videos matching/)).toBeNull();
  });
});

it('starts again from the first 50 when the category filter changes', () => {
  const { container } = renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Show more (70 left)' }));
  expect(cardCount(container)).toBe(100);

  // Clicking the first card's tag chip filters to its category: 60 "even" videos.
  fireEvent.click(container.querySelector('.video-tag'));

  expect(cardCount(container)).toBe(50);
  expect(screen.getByRole('button', { name: 'Show more (10 left)' })).toBeInTheDocument();
});
