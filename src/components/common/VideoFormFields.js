import TagEditor from './TagEditor';
import './VideoFormFields.css';

/**
 * The video form body, shared by the add- and edit-video dialogs.
 *
 * The thumbnail preview is rendered by the dialog shell (floated beside it),
 * so this component is purely the field set.
 *
 * @param {object} formData
 * @param {(updater: object|Function) => void} setFormData
 * @param {string[]} tags               global tag vocabulary
 * @param {(tag: string) => void} onCreateTag  persists a brand-new tag
 */
const VideoFormFields = ({ formData, setFormData, tags = [], onCreateTag }) => {
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const addTag = (tag) => {
    setFormData((prev) => {
      const selectedTags = Array.isArray(prev.tags) ? prev.tags : [];
      return selectedTags.includes(tag) ? prev : { ...prev, tags: [...selectedTags, tag] };
    });
  };

  const removeTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: (Array.isArray(prev.tags) ? prev.tags : []).filter((tag) => tag !== tagToRemove),
    }));
  };

  const createTag = (tag) => {
    onCreateTag?.(tag);
    addTag(tag);
  };

  return (
    <div className="video-form-fields">
      <div className="label-input">
        <div className="label-content">Video Name</div>
        <input
          type="text"
          name="name"
          placeholder="Video Name"
          value={formData.name || ''}
          onChange={handleInputChange}
        />
      </div>

      <div className="label-input">
        <div className="label-content">Thumbnail URL</div>
        <input
          type="url"
          name="imageUrl"
          placeholder="Image URL"
          value={formData.imageUrl || ''}
          onChange={handleInputChange}
        />
      </div>

      <div className="label-input">
        <div className="label-content">Video URL</div>
        <input
          type="url"
          name="url"
          placeholder="Video URL"
          value={formData.url || ''}
          onChange={handleInputChange}
        />
      </div>

      <div className="label-input-row">
        <div className="label-input duration-input">
          <div className="label-content">Video Duration</div>
          <input
            type="text"
            name="videoDuration"
            placeholder="Duration"
            value={formData.videoDuration || ''}
            onChange={handleInputChange}
          />
        </div>
        <div className="label-input vpn-input">
          <div className="label-content">VPN Needed?</div>
          <label className="vpn-checkbox-label">
            <input
              type="checkbox"
              name="isVPN"
              checked={!!formData.isVPN}
              onChange={handleInputChange}
            />
            <span className="vpn-checkbox-text">{formData.isVPN ? 'Yes' : 'No'}</span>
          </label>
        </div>
      </div>

      <div className="tag-section">
        <TagEditor
          selectedTags={Array.isArray(formData.tags) ? formData.tags : []}
          availableTags={tags}
          onAdd={addTag}
          onRemove={removeTag}
          onCreate={createTag}
        />
      </div>
    </div>
  );
};

export default VideoFormFields;
