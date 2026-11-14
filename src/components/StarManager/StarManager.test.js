import { useState, useMemo } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import StarManager from './StarManager';
import Header from '../Header/Header';
import { HeaderSlotContext } from '../Header/headerSlot';

const stars = [
  { Name: 'Amara Dawn', Image_Link: 'a.jpg' },
  { Name: 'Bea Noor', Image_Link: 'b.jpg' },
];

const Location = () => <p data-testid="location">{useLocation().pathname}</p>;

const renderPage = (updateStarDetails = jest.fn()) => {
  const result = render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<StarManager stars={stars} updateStarDetails={updateStarDetails} />} />
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>
  );
  return { ...result, updateStarDetails };
};

const card = (container, name) =>
  [...container.querySelectorAll('.star-frame')].find((el) => el.textContent.includes(name));

describe('star cards', () => {
  it.each([
    ['the photo', '.image-container img'],
    ['the name', '.star-info h3'],
    ['the empty space around the name', '.star-info'],
  ])('open the star from %s', (_, selector) => {
    const { container } = renderPage();
    fireEvent.click(card(container, 'Bea Noor').querySelector(selector));
    expect(screen.getByTestId('location')).toHaveTextContent('/star/bea%20noor');
  });

  it('show initials across the card when the photo fails, and still open', () => {
    const { container } = renderPage();
    const frame = card(container, 'Amara Dawn');
    fireEvent.error(frame.querySelector('img'));

    expect(frame.querySelector('img')).toBeNull();
    expect(frame.querySelector('.star-image-fallback')).toHaveTextContent('AD');
    fireEvent.click(frame.querySelector('.star-image-fallback'));
    expect(screen.getByTestId('location')).toHaveTextContent('/star/amara%20dawn');
  });

  it('open with the keyboard', () => {
    const { container } = renderPage();
    fireEvent.keyDown(card(container, 'Bea Noor'), { key: 'Enter' });
    expect(screen.getByTestId('location')).toHaveTextContent('/star/bea%20noor');
  });

  it('delete without opening the star', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const { updateStarDetails } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Bea Noor' }));
    expect(updateStarDetails).toHaveBeenCalledWith([stars[0]]);
    expect(screen.queryByTestId('location')).toBeNull();
  });
});

it('adds a star from the page controls', () => {
  const { updateStarDetails } = renderPage();

  fireEvent.click(screen.getByRole('button', { name: 'Add star' }));
  expect(screen.getByRole('heading', { name: 'Add New Star' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('heading', { name: 'Add New Star' })).toBeNull();
  expect(updateStarDetails).not.toHaveBeenCalled();
});

it("opens the new star's page straight after Save Star", () => {
  const { updateStarDetails } = renderPage();

  fireEvent.click(screen.getByRole('button', { name: 'Add star' }));
  fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Cleo Vance' } });
  fireEvent.change(screen.getByPlaceholderText('Image Link'), { target: { value: 'https://example.test/c.jpg' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Star' }));

  expect(updateStarDetails).toHaveBeenCalledWith([...stars, expect.objectContaining({ Name: 'Cleo Vance' })]);
  expect(screen.getByTestId('location')).toHaveTextContent('/star/cleo%20vance');
});

it('closes the Add Star dialog with Esc', () => {
  const { updateStarDetails } = renderPage();

  fireEvent.click(screen.getByRole('button', { name: 'Add star' }));
  fireEvent.keyDown(screen.getByPlaceholderText('Name'), { key: 'Escape' });

  expect(screen.queryByRole('heading', { name: 'Add New Star' })).toBeNull();
  expect(updateStarDetails).not.toHaveBeenCalled();
});

it('puts its controls in the header when there is one', () => {
  const WithHeader = () => {
    const [slot, setSlot] = useState(null);
    const value = useMemo(() => ({ slot, setSlot }), [slot]);
    return (
      <HeaderSlotContext.Provider value={value}>
        <Header onSignOut={() => {}} onSync={() => {}} onFetchData={() => {}} />
        <StarManager stars={stars} updateStarDetails={() => {}} />
      </HeaderSlotContext.Provider>
    );
  };
  render(
    <MemoryRouter>
      <WithHeader />
    </MemoryRouter>
  );

  const header = screen.getByRole('banner');
  for (const name of ['Add star', 'Shuffle stars', 'Sort stars alphabetically']) {
    expect(within(header).getByRole('button', { name })).toBeInTheDocument();
  }
});
