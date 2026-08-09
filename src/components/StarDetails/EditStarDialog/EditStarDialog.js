import { useState } from 'react';
import ThumbnailPreview from '../../common/ThumbnailPreview';
import './EditStarDialog.css';

/**
 * Edit a star's thumbnail.
 *
 * The name is deliberately read-only: it is the route param *and* the key its
 * videos are filed under, so renaming would orphan them.
 *
 * @param {object}   star     the star being edited
 * @param {Function} onSave   receives the updated star
 * @param {Function} onCancel
 */
const EditStarDialog = ({ star, onSave, onCancel }) => {
  const [form, setForm] = useState({
    Image_Link: star.Image_Link || '',
    Data_Base: star.Data_Base || '',
  });
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    const imageLink = form.Image_Link.trim();
    if (!imageLink) {
      setError('A thumbnail URL is required.');
      return;
    }

    setError('');
    // Data Base is optional; everything else on the star is carried through.
    onSave({ ...star, Image_Link: imageLink, Data_Base: form.Data_Base.trim() });
  };

  return (
    <div className="modal-overlay edit-star-overlay">
      <ThumbnailPreview imageUrl={form.Image_Link} className="modal-floating-preview" />

      <div className="modal-dialog edit-star-dialog">
        <div className="edit-star-header">
          <h2><i className="fas fa-user-edit"></i> Edit Star Profile</h2>
          <div className="header-decoration"></div>
        </div>

        <div className="edit-star-body">
          <div className="input-group">
            <div className="input-label">
              <i className="fas fa-tag"></i>
              <span>Name</span>
            </div>
            <div className="input-wrapper disabled">
              <input type="text" value={star.Name} disabled readOnly />
              <div className="input-icon">
                <i className="fas fa-lock"></i>
              </div>
            </div>
            <div className="input-hint">Name cannot be modified</div>
          </div>

          <div className="input-group">
            <div className="input-label">
              <i className="fas fa-image"></i>
              <span>Thumbnail URL</span>
            </div>
            <div className="input-wrapper">
              <input
                type="url"
                name="Image_Link"
                placeholder="Image URL"
                value={form.Image_Link}
                onChange={handleInputChange}
              />
              <div className="input-icon">
                <i className="fas fa-link"></i>
              </div>
            </div>
            <div className="input-hint">Enter a valid image URL (JPG, PNG, GIF)</div>
          </div>

          <div className="input-group">
            <div className="input-label">
              <i className="fas fa-database"></i>
              <span>Data Base</span>
            </div>
            <div className="input-wrapper">
              <input
                type="url"
                name="Data_Base"
                placeholder="https://example.com/profile"
                value={form.Data_Base}
                onChange={handleInputChange}
              />
              <div className="input-icon">
                <i className="fas fa-database"></i>
              </div>
            </div>
            <div className="input-hint">Optional — leave blank to hide the Data Base button</div>
          </div>

          {error && <p className="modal-error" role="alert">{error}</p>}
        </div>

        <div className="edit-star-footer">
          <button type="button" className="btn cancel-btn" onClick={onCancel}>
            <i className="fas fa-times"></i>
            Cancel
          </button>
          <button type="button" className="btn save-btn" onClick={handleSave}>
            <i className="fas fa-save"></i>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditStarDialog;
