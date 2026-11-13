import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import * as storage from '../../utils/storage';
import * as themeService from '../../services/themeService';
import Header from './Header';

const Location = () => {
  const location = useLocation();
  return <p data-testid="location">{location.pathname + location.search}</p>;
};

const handlers = () => ({ onSignOut: jest.fn(), onSync: jest.fn(), onFetchData: jest.fn() });

const renderHeader = (props = handlers()) => {
  render(
    <MemoryRouter>
      <Header {...props} />
      <Routes>
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>
  );
  return props;
};

const location = () => screen.getByTestId('location').textContent;

beforeEach(() => {
  Object.values(storage.KEYS).forEach((key) => storage.removeItem(key));
  storage.setItem(storage.KEYS.STARS, [{ Name: 'Amara Dawn', Image_Link: 'a.jpg' }]);
  storage.setItem(storage.KEYS.FAVORITES, {
    'amara dawn': [
      { id: 1, name: 'Drama at Dawn', imageUrl: '1.jpg', url: 'https://example.test/1', tags: ['Drama'] },
    ],
  });
  storage.setItem(storage.KEYS.TAGS, ['Drama']);
});

afterEach(() => {
  themeService.setTheme('light');
  localStorage.clear();
});

describe('dark mode toggle', () => {
  const darkModeButton = () => screen.getByRole('button', { name: 'Dark mode' });

  it('starts in light mode', () => {
    renderHeader();
    expect(darkModeButton()).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('turns dark mode on and off, and remembers the choice', () => {
    renderHeader();

    fireEvent.click(darkModeButton());
    expect(darkModeButton()).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    fireEvent.click(darkModeButton());
    expect(darkModeButton()).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(localStorage.getItem('theme')).toBe('light');
  });
});

describe('sync and sign-out menu', () => {
  const menuButton = () => screen.getByRole('button', { name: /Sync and sign out/ });

  it('keeps Fetch, Sync and Sign out out of the header until opened', () => {
    renderHeader();
    expect(screen.queryByRole('button', { name: /Sign out/ })).toBeNull();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it.each([
    ['Fetch from Drive', 'onFetchData'],
    ['Sync to Drive', 'onSync'],
    ['Sign out', 'onSignOut'],
  ])('runs "%s" from the menu and closes it', (label, handler) => {
    const props = renderHeader();

    fireEvent.click(menuButton());
    const menu = screen.getByRole('group', { name: 'Sync and sign out' });
    fireEvent.click(within(menu).getByRole('button', { name: new RegExp(label) }));

    expect(props[handler]).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group', { name: 'Sync and sign out' })).toBeNull();
  });

  it('closes on Esc and on a click elsewhere', () => {
    renderHeader();

    fireEvent.click(menuButton());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Sync and sign out' })).toBeNull();
    expect(menuButton()).toHaveFocus();

    fireEvent.click(menuButton());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('group', { name: 'Sync and sign out' })).toBeNull();
  });
});

describe('search', () => {
  const searchBox = () => screen.findByRole('combobox', { name: 'Search' });

  it('opens from the 🔍 button, Ctrl+K and "/"', async () => {
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.keyDown(await searchBox(), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    fireEvent.keyDown(await searchBox(), { key: 'Escape' });

    fireEvent.keyDown(window, { key: '/' });
    expect(await searchBox()).toHaveFocus();
  });

  it('ignores "/" while typing in a field', () => {
    renderHeader();
    const field = document.createElement('input');
    document.body.appendChild(field);

    fireEvent.keyDown(field, { key: '/' });

    expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
    field.remove();
  });

  it('shows grouped results and opens the highlighted one with Enter', async () => {
    renderHeader();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const box = await searchBox();

    fireEvent.change(box, { target: { value: 'dawn' } });
    const results = screen.getByRole('listbox', { name: 'Results' });
    expect(within(results).getByRole('group', { name: 'Stars' })).toHaveTextContent('Amara Dawn');
    expect(within(results).getByRole('group', { name: 'Videos' })).toHaveTextContent('Drama at Dawn');

    // The first result (the star) is highlighted; Enter opens their page.
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(location()).toBe('/star/amara%20dawn');
    expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
  });

  it('opens a category with the arrow keys', async () => {
    renderHeader();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const box = await searchBox();

    fireEvent.change(box, { target: { value: 'drama' } });
    // Results: the video, then the category.
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'Enter' });

    expect(location()).toBe('/videos?tag=Drama');
  });

  it('says when nothing matches', async () => {
    renderHeader();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    fireEvent.change(await searchBox(), { target: { value: 'zzz' } });
    expect(screen.getByText('Nothing matches “zzz”.')).toBeInTheDocument();
  });
});
