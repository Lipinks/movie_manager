import { useState } from 'react';
import VideoFormFields from './VideoFormFields';
import ThumbnailPreview from './ThumbnailPreview';
import Dropdown from './Dropdown';
import './VideoDialog.css';

/**
 * The one dialog used for both adding and editing a video.
 *
 * AddVidDialog and EditVidDialog had converged to the point of being the same
 * component with different labels, so they are now this. It owns its own draft
 * state — callers hand in the starting value and receive the finished record
 * in `onSave`, which keeps the surrounding pages free of throwaway form state.
 *
 * @param {string}   title
 * @param {string}   saveLabel
 * @param {object}   [initialValue]   existing video when editing
 * @param {string[]} [tags]           global tag vocabulary
 * @param {Function} [onCreateTag]    persists a brand-new tag
 * @param {Function} onSave           receives the completed video object
 * @param {Function} onCancel
 * @param {Array}    [starOptions]    when supplied, a star picker is shown —
 *                                    used by the videos page, where the target
 *                                    star is not implied by the route
 * @param {string}   [initialStarName]
 */

const EMPTY_VIDEO = {
  name: '',
  imageUrl: '',
  url: '',
  videoDuration: '',
  isVPN: false,
  tags: [],
};

const VideoDialog = ({
  title,
  saveLabel = 'Save',
  initialValue,
  tags = [],
  onCreateTag,
  onSave,
  onCancel,
  starOptions = null,
  initialStarName = '',
}) => {
  const [formData, setFormData] = useState(() => ({
    ...EMPTY_VIDEO,
    ...initialValue,
    tags: Array.isArray(initialValue?.tags) ? initialValue.tags : [],
  }));
  const [starName, setStarName] = useState(initialStarName);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!formData.name.trim() || !formData.imageUrl.trim()) {
      setError('Video name and thumbnail URL are both required.');
      return;
    }
    if (starOptions && !starName) {
      setError('Choose which star this video belongs to.');
      return;
    }

    setError('');
    onSave(starOptions ? { ...formData, starName } : formData);
  };

  return (
    <div className="modal-overlay video-dialog-overlay">
      <ThumbnailPreview imageUrl={formData.imageUrl} className="modal-floating-preview" />

      <div className="modal-dialog modal-dialog--gold video-dialog">
        <h2 className="modal-title">{title}</h2>

        {starOptions && (
          <div className="video-dialog-star">
            <div className="label-content">Star</div>
            <Dropdown
              value={starName}
              options={starOptions}
              onSelect={setStarName}
              placeholder="Select a star"
            />
          </div>
        )}

        <VideoFormFields
          formData={formData}
          setFormData={setFormData}
          tags={tags}
          onCreateTag={onCreateTag}
        />

        {error && <p className="modal-error" role="alert">{error}</p>}

        <div className="modal-buttons">
          <button type="button" onClick={handleSave} className="save-btn">{saveLabel}</button>
          <button type="button" onClick={onCancel} className="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default VideoDialog;
