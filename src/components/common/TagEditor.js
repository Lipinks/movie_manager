import { useState } from 'react';
import './TagEditor.css';

/**
 * Reusable tag picker: shows the currently selected tags, the remaining
 * available tags, and an input to create a brand-new tag. Replaces the tag
 * UI + handlers that were duplicated across the add-star, edit-star and
 * edit-video dialogs.
 *
 * @param {string[]} selectedTags   tags currently applied to the item
 * @param {string[]} availableTags  the global list of known tags
 * @param {(tag:string)=>void} onAdd     add an existing tag to the selection
 * @param {(tag:string)=>void} onRemove  remove a tag from the selection
 * @param {(tag:string)=>void} onCreate  create a new tag (and select it)
 */
const TagEditor = ({ selectedTags = [], availableTags = [], onAdd, onRemove, onCreate }) => {
  const [newTag, setNewTag] = useState('');

  const createTag = () => {
    const value = newTag.trim();
    if (!value) return;
    onCreate?.(value);
    setNewTag('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      createTag();
    }
  };

  const selectable = availableTags.filter((tag) => !selectedTags.includes(tag));

  return (
    <div className="tag-editor">
      <div className="tag-editor-label">Selected Tags</div>
      <div className="tag-editor-selected">
        {selectedTags.length === 0 && <span className="tag-editor-empty">None selected</span>}
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="tag-editor-tag selected"
            onClick={() => onRemove?.(tag)}
            title="Click to remove"
          >
            {tag}
            <span className="tag-editor-icon">×</span>
          </span>
        ))}
      </div>

      <div className="tag-editor-label">Available Tags</div>
      <div className="tag-editor-available">
        {selectable.length === 0 && <span className="tag-editor-empty">No more tags</span>}
        {selectable.map((tag) => (
          <span
            key={tag}
            className="tag-editor-tag available"
            onClick={() => onAdd?.(tag)}
            title="Click to add"
          >
            {tag}
            <span className="tag-editor-icon">+</span>
          </span>
        ))}
      </div>

      <div className="tag-editor-create">
        <input
          type="text"
          className="tag-editor-input"
          placeholder="Create new tag"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="button" onClick={createTag} className="tag-editor-create-btn">
          Create Tag
        </button>
      </div>
    </div>
  );
};

export default TagEditor;
