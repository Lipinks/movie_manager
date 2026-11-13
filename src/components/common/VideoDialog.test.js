import { render, screen, fireEvent } from '@testing-library/react';
import VideoDialog from './VideoDialog';

const selectedTags = () =>
  [...document.querySelectorAll('.tag-editor-tag.selected')].map((el) => el.textContent.replace('×', '').trim());

const durationField = () => screen.getByPlaceholderText('mm:ss');

const renderDialog = (props = {}) => {
  const onSave = jest.fn();
  render(
    <VideoDialog
      title="Add New Video"
      tags={['Drama', 'Travel', 'Comedy', 'Music']}
      onSave={onSave}
      onCancel={() => {}}
      {...props}
    />
  );
  return onSave;
};

describe('video duration', () => {
  it('adds the colon after the minutes', () => {
    renderDialog();
    fireEvent.change(durationField(), { target: { value: '12' } });
    expect(durationField()).toHaveValue('12:');

    fireEvent.change(durationField(), { target: { value: '12:34' } });
    expect(durationField()).toHaveValue('12:34');
  });

  it("lets backspace remove the colon without it coming straight back", () => {
    renderDialog();
    fireEvent.change(durationField(), { target: { value: '12' } });
    fireEvent.input(durationField(), { target: { value: '12' }, inputType: 'deleteContentBackward' });
    expect(durationField()).toHaveValue('12');
  });
});

describe("a new video starts with its star's tags", () => {
  it("on the star's page", () => {
    renderDialog({ defaultTags: ['Drama', 'Travel'] });
    expect(selectedTags()).toEqual(['Drama', 'Travel']);
  });

  it('when a star is picked, swapping them if another star is picked', () => {
    const tagsOf = { Amara: ['Drama', 'Travel'], Bea: ['Comedy'] };
    renderDialog({
      starOptions: [
        { value: 'Amara', label: 'Amara' },
        { value: 'Bea', label: 'Bea' },
      ],
      starTagsFor: (name) => tagsOf[name] || [],
    });
    const pick = (name) => {
      fireEvent.click(screen.getByRole('button', { name: /Select a star|Amara|Bea/ }));
      fireEvent.click(screen.getByText(name, { selector: '.dropdown-option' }));
    };

    pick('Amara');
    expect(selectedTags()).toEqual(['Drama', 'Travel']);

    // The user picks one tag by hand and removes one of Amara's.
    fireEvent.click(screen.getByText('Music', { selector: '.tag-editor-tag.available' }));
    fireEvent.click(screen.getByText('Travel', { selector: '.tag-editor-tag.selected' }));
    expect(selectedTags()).toEqual(['Drama', 'Music']);

    // Switching star swaps Amara's remaining tag for Bea's, keeping "Music".
    pick('Bea');
    expect(selectedTags()).toEqual(['Music', 'Comedy']);
  });

  it('saves the tags with the video, and editing leaves tags alone', () => {
    const onSave = renderDialog({ defaultTags: ['Drama'] });
    fireEvent.change(screen.getByPlaceholderText('Video Name'), { target: { value: 'Clip' } });
    fireEvent.change(screen.getByPlaceholderText('Image URL'), { target: { value: 'https://example.test/i.jpg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Clip', tags: ['Drama'] }));
  });

  it('does not add the star tags when editing an existing video', () => {
    renderDialog({ initialValue: { name: 'Old', imageUrl: 'x', tags: ['Music'] }, defaultTags: ['Drama'] });
    expect(selectedTags()).toEqual(['Music']);
  });
});
