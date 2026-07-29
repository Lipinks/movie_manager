import './EditVidDialog.css';
import { useState, useEffect } from 'react';
import VideoFormFields from '../../common/VideoFormFields';
import ThumbnailPreview from '../../common/ThumbnailPreview';
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

  const handleSave = () => {
    handleEditFavorite(editingVideo.id, { ...formData, modification: nowInIST() }, editingVideo.starName);
  };

  return (
    <div className="edit-vid-overlay">
      <ThumbnailPreview imageUrl={formData.imageUrl} className="edit-vid-floating-preview" />
      <div className="edit-vid-dialog">
        <h2 className="edit_video_text">Edit Video</h2>
        <VideoFormFields
          formData={formData}
          setFormData={setFormData}
          tags={tags}
          handleCreateNewTag={handleCreateNewTag}
          showPreview={false}
        />
        <div className="modal-buttons">
          <button onClick={handleSave} className="save-btn">Save Changes</button>
          <button onClick={() => setEditingVideo(null)} className="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default EditVidDialog;
