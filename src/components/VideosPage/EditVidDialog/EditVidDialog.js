import './EditVidDialog.css';
import { useState, useEffect } from 'react';
import TagEditor from '../../common/TagEditor';
import { nowInIST } from '../../../utils/dateUtils';

const EditVidDialog = ({ editingVideo, handleEditFavorite, setEditingVideo, tags, handleCreateNewTag }) => {
  const [formData, setFormData] = useState({
    name: '',
    imageUrl: '',
    url: '',
    videoDuration: '',
    isVPN: false,
    creation: '',
    modification: '',
    tags: [],
  });

  useEffect(() => {
    if (editingVideo) {
      setFormData({
        name: editingVideo.name || '',
        imageUrl: editingVideo.imageUrl || '',
        url: editingVideo.url || '',
        videoDuration: editingVideo.videoDuration || '',
        isVPN: editingVideo.isVPN || false,
        creation: editingVideo.creation || '',
        modification: editingVideo.modification || '',
        tags: editingVideo.tags || [],
      });
    }
  }, [editingVideo]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = () => {
    handleEditFavorite(editingVideo.id, { ...formData, modification: nowInIST() }, editingVideo.starName);
  };

  const addTag = (tag) => {
    setFormData((prev) => (prev.tags.includes(tag) ? prev : { ...prev, tags: [...prev.tags, tag] }));
  };

  const removeTag = (tagToRemove) => {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((tag) => tag !== tagToRemove) }));
  };

  const createTag = (tag) => {
    if (!tags.includes(tag)) {
      handleCreateNewTag(tag);
    }
    addTag(tag);
  };

  return (
    <div className="edit-dialog">
      <div className='label-input'>
        <div className='label-content'>Video Name</div>
        <input
          type="text"
          name="name"
          placeholder="Video Name"
          value={formData.name}
          onChange={handleInputChange}
        />
      </div>
      <div className='label-input'>
        <div className='label-content'>Thumbnail URL</div>
        <input
          type="url"
          name="imageUrl"
          placeholder="Image URL"
          value={formData.imageUrl}
          onChange={handleInputChange}
        />
      </div>
      <div className='label-input'>
        <div className='label-content'>Video URL</div>
        <input
          type="url"
          name="url"
          placeholder="Video URL"
          value={formData.url}
          onChange={handleInputChange}
        />
      </div>

      <div className='label-input-row'>
        <div className='label-input duration-input'>
          <div className='label-content'>Video Duration</div>
          <input
            type="text"
            name="videoDuration"
            placeholder="Duration"
            value={formData.videoDuration}
            onChange={handleInputChange}
          />
        </div>
        <div className='label-input vpn-input'>
          <div className='label-content'>VPN Needed?</div>
          <label className="vpn-checkbox-label">
            <input
              type="checkbox"
              name="isVPN"
              checked={formData.isVPN}
              onChange={handleInputChange}
            />
            <span className="vpn-checkbox-text">{formData.isVPN ? 'Yes' : 'No'}</span>
          </label>
        </div>
      </div>

      <div className="tag-section">
        <TagEditor
          selectedTags={formData.tags}
          availableTags={tags}
          onAdd={addTag}
          onRemove={removeTag}
          onCreate={createTag}
        />
        <div className="create-new-tag">
          <button onClick={handleSave} className="save-btn">Save Changes</button>
          <button onClick={() => setEditingVideo(null)} className="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default EditVidDialog;
