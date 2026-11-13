import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StarManager from './StarManager';

const stars = [
  { Name: 'Amara Dawn', Image_Link: 'a.jpg' },
  { Name: 'Bea Noor', Image_Link: 'b.jpg' },
];

const renderPage = (updateStarDetails = jest.fn()) => {
  render(
    <MemoryRouter>
      <StarManager stars={stars} updateStarDetails={updateStarDetails} />
    </MemoryRouter>
  );
  return updateStarDetails;
};

it('shows the star count and the page controls in its toolbar', () => {
  renderPage();
  expect(screen.getByRole('heading', { name: /Stars\s*2/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Shuffle stars' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sort stars alphabetically' })).toBeInTheDocument();
});

it('adds a star from the Home page', () => {
  const updateStarDetails = renderPage();

  fireEvent.click(screen.getByRole('button', { name: /Add Star/ }));
  expect(screen.getByRole('heading', { name: 'Add New Star' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('heading', { name: 'Add New Star' })).toBeNull();
  expect(updateStarDetails).not.toHaveBeenCalled();
});
