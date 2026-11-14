import { render, screen, fireEvent } from '@testing-library/react';
import * as storage from '../../../utils/storage';
import EditStarDialog from './EditStarDialog';
import AddStarDialog from '../../StarManager/AddStarDialog/AddStarDialog';

const selectedTags = () =>
  [...document.querySelectorAll('.tag-editor-tag.selected')].map((el) => el.textContent.replace('×', '').trim());

beforeEach(() => {
  Object.values(storage.KEYS).forEach((key) => storage.removeItem(key));
  storage.setItem(storage.KEYS.TAGS, ['Drama', 'Travel']);
});

describe('Edit Star', () => {
  it("shows the star's tags and saves changes to them", () => {
    const onSave = jest.fn();
    render(
      <EditStarDialog
        star={{ Name: 'Amara Dawn', Image_Link: 'https://example.test/a.jpg', Tags: ['Drama'] }}
        onSave={onSave}
        onCancel={() => {}}
      />
    );
    expect(selectedTags()).toEqual(['Drama']);

    fireEvent.click(screen.getByText('Travel', { selector: '.tag-editor-tag.available' }));
    fireEvent.click(screen.getByText('Drama', { selector: '.tag-editor-tag.selected' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ Name: 'Amara Dawn', Tags: ['Travel'] }));
  });

  it('closes with Esc, without saving', () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    render(<EditStarDialog star={{ Name: 'Amara', Image_Link: 'x' }} onSave={onSave} onCancel={onCancel} />);

    fireEvent.keyDown(screen.getByPlaceholderText('Image URL'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('copes with stars saved before they had tags', () => {
    render(<EditStarDialog star={{ Name: 'Old', Image_Link: 'x' }} onSave={() => {}} onCancel={() => {}} />);
    expect(selectedTags()).toEqual([]);
  });
});

describe('Add Star', () => {
  it('saves the tags picked for the new star, reusing an existing spelling', () => {
    const onSave = jest.fn();
    render(<AddStarDialog onSave={onSave} onCancel={() => {}} isDuplicateName={() => false} />);

    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Bea Noor' } });
    fireEvent.change(screen.getByPlaceholderText('Image Link'), { target: { value: 'https://example.test/b.jpg' } });
    fireEvent.click(screen.getByText('Travel', { selector: '.tag-editor-tag.available' }));
    // Typing "drama" when "Drama" exists picks "Drama" rather than adding a twin.
    fireEvent.change(screen.getByPlaceholderText(/new tag/i), { target: { value: 'drama' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/new tag/i), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Save Star' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ Name: 'Bea Noor', Tags: ['Travel', 'Drama'] }));
    expect(storage.getItem(storage.KEYS.TAGS)).toEqual(['Drama', 'Travel']);
  });
});
