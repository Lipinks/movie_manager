import './AddVidDialog.css';
import VideoFormFields from '../../common/VideoFormFields';
import ThumbnailPreview from '../../common/ThumbnailPreview';
import Dropdown from '../../common/Dropdown';

const AddVidDialog = ({
  newFavorite,
  setNewFavorite,
  handleAddFavorite,
  setShowVidAddModal,
  tags,
  handleCreateNewTag,
  starOptions,
  onStarChange,
}) => {
  return (
    <div className="add-vid-overlay">
      <ThumbnailPreview imageUrl={newFavorite.imageUrl} className="add-vid-floating-preview" />
      <div className="add-vid-dialog">
        <h2 className='add_new_video_text'>Add New Video</h2>
        {starOptions && (
          <div className="label-input star-select-row">
            <div className="label-content">Star</div>
            <Dropdown
              value={newFavorite.starName}
              options={starOptions}
              onSelect={onStarChange}
              placeholder="Select a star"
            />
          </div>
        )}
        <VideoFormFields
          formData={newFavorite}
          setFormData={setNewFavorite}
          tags={tags}
          handleCreateNewTag={handleCreateNewTag}
          showPreview={false}
        />
        <div className="modal-buttons">
          <button onClick={handleAddFavorite} className="save-btn">Save</button>
          <button onClick={() => setShowVidAddModal(false)} className="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default AddVidDialog;