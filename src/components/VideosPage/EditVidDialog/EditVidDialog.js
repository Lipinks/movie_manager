import './EditVidDialog.css';
import { useState, useEffect } from 'react';

const EditVidDialog = ({ editingVideo, handleEditFavorite, setEditingVideo, tags, handleCreateNewTag }) => {
  const [formData, setFormData] = useState({
    name: '',
    imageUrl: '',
    url: '',
    videoDuration: '',
    isVPN: false,
    creation: '',
    modification: '',
    tags: []
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
        tags: editingVideo.tags || []
      });
    }
  }, [editingVideo]);
  const [newTag, setNewTag] = useState('');

  const handleInputChange = (e) => {
    var { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = () => {
    var now = new Date();
    var istOptions = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
    var istParts = new Intl.DateTimeFormat('en-CA', istOptions).formatToParts(now);
    var getPart = (type) => istParts.find(p => p.type === type)?.value || '';
    var currentDateTime = `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}`;
    var updatedFormData = {
      ...formData,
      modification: currentDateTime
    };
    handleEditFavorite(editingVideo.id, updatedFormData, editingVideo.starName);
  };

  const handleAddTag = (tag) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleCreateTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      handleCreateNewTag(newTag.trim());
      handleAddTag(newTag.trim());
      setNewTag('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleCreateTag();
    }
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
        <div className="label-content">Selected Tags</div>
        <div className="selected-tags">
          {formData.tags.map(tag => (
            <span 
              key={tag} 
              className="tag selected-tag"
              onClick={() => handleRemoveTag(tag)}
              title="Click to remove"
            >
              {tag}
              <span className="remove-icon">×</span>
            </span>
          ))}
        </div>
        
        <div className="label-content">Available Tags</div>
        <div className="available-tags">
          {tags
            .filter(tag => !formData.tags.includes(tag))
            .map(tag => (
              <span 
                key={tag} 
                className="tag available-tag"
                onClick={() => handleAddTag(tag)}
                title="Click to add"
              >
                {tag}
                <span className="add-icon">+</span>
              </span>
            ))}
        </div>
        
        <div className="create-new-tag">
          <input
            type="text"
            className="new-tag-input"
            placeholder="Create new tag"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button onClick={handleCreateTag} className="create-tag-btn">
            Create Tag
          </button>
          <button onClick={handleSave} className="save-btn">Save Changes</button>
          <button onClick={() => setEditingVideo(null)} className="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default EditVidDialog;