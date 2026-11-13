import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as themeService from '../../services/themeService';
import Header from './Header';

const renderHeader = () =>
  render(
    <MemoryRouter>
      <Header onAddStar={() => {}} onSignOut={() => {}} onSync={() => {}} onFetchData={() => {}} />
    </MemoryRouter>
  );

const darkModeButton = () => screen.getByRole('button', { name: 'Dark mode' });

afterEach(() => {
  themeService.setTheme('light');
  localStorage.clear();
});

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
