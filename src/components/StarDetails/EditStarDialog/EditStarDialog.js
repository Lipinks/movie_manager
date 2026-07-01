import './EditStarDialog.css';
import TagEditor from '../../common/TagEditor';

const EditStarDialog = ({ editedStar, handleInputChange, handleEditSave, setShowVidEditModal, handleAddTagToStar, handleRemoveTagFromStar, availableTags, handleCreateNewTag }) => {
  return (
      <div className="edit-star-overlay">
        <div className="edit-star-dialog">
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
                <input
                  type="text"
                  name="Name"
                  placeholder="Name"
                  value={editedStar.Name}
                  onChange={handleInputChange}
                  disabled={true}
                />
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
                  value={editedStar.Image_Link}
                  onChange={handleInputChange}
                />
                <div className="input-icon">
                  <i className="fas fa-link"></i>
                </div>
              </div>
              <div className="input-hint">Enter a valid image URL (JPG, PNG, GIF)</div>
            </div>

            <div className="input-group">
              <TagEditor
                selectedTags={Array.isArray(editedStar.Tags) ? editedStar.Tags : []}
                availableTags={availableTags}
                onAdd={handleAddTagToStar}
                onRemove={handleRemoveTagFromStar}
                onCreate={handleCreateNewTag}
              />
            </div>
          </div>

          <div className="edit-star-footer">
            <button className="btn cancel-btn" onClick={() => setShowVidEditModal(false)}>
              <i className="fas fa-times"></i>
              Cancel
            </button>
            <button className="btn save-btn" onClick={handleEditSave}>
              <i className="fas fa-save"></i>
              Save Changes
            </button>
          </div>

        </div>
      </div>
  );
};

export default EditStarDialog;
