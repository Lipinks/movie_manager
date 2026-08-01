import { useState } from 'react';
import ThumbnailPreview from '../../common/ThumbnailPreview';
import './AddStarDialog.css';

/**
 * Create-a-star dialog. Owns its own draft so StarManager does not have to
 * carry throwaway form state, mirroring how VideoDialog works.
 *
 * @param {Function} onSave     receives { Name, Image_Link, Tags }
 * @param {Function} onCancel
 * @param {(name: string) => boolean} isDuplicateName
 */
const AddStarDialog = ({ onSave, onCancel, isDuplicateName }) => {
  const [star, setStar] = useState({ Name: '', Image_Link: '', Tags: [] });
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setStar((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    const name = star.Name.trim();
    const imageLink = star.Image_Link.trim();

    if (!name || !imageLink) {
      setError('Both a name and an image link are required.');
      return;
    }
    if (isDuplicateName?.(name)) {
      setError(`A star named "${name}" already exists.`);
      return;
    }

    setError('');
    onSave({ ...star, Name: name, Image_Link: imageLink });
  };

  return (
    <div className="modal-overlay add-star-overlay">
      <ThumbnailPreview imageUrl={star.Image_Link} className="modal-floating-preview" />

      <div className="modal-dialog modal-dialog--gold add-star-dialog">
        <h2 className="modal-title">Add New Star</h2>

        <div className="add-star-fields">
          <input
            type="text"
            name="Name"
            placeholder="Name"
            value={star.Name}
            onChange={handleInputChange}
          />
          <input
            type="url"
            name="Image_Link"
            placeholder="Image Link"
            value={star.Image_Link}
            onChange={handleInputChange}
          />
        </div>

        {error && <p className="modal-error" role="alert">{error}</p>}

        <div className="modal-buttons">
          <button type="button" onClick={handleSave} className="save-btn">Save Star</button>
          <button type="button" onClick={onCancel} className="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default AddStarDialog;
