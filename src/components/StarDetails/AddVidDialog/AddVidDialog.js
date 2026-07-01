import './AddVidDialog.css';

const AddVidDialog = ({ newFavorite, setNewFavorite, handleAddFavorite, setShowVidAddModal }) => {
  return (
    <div className="add-vid-overlay">
      <div className="add-vid-dialog">
        <h2 className='add_new_video_text'>Add New Video</h2>
        <div className="input-label">
          <i className="fas fa-tag"></i>
          <span>Name</span>
        </div>
        <input
          type="text"
          placeholder="Name"
          value={newFavorite.name}
          onChange={(e) => setNewFavorite({ ...newFavorite, name: e.target.value })}
        />
        <div className="input-label">
          <i className="fas fa-tag"></i>
          <span>Thumbnail URL</span>
        </div>
        <input
          type="url"
          placeholder="Thumbnail URL"
          value={newFavorite.imageUrl}
          onChange={(e) => setNewFavorite({ ...newFavorite, imageUrl: e.target.value })}
        />
        <div className="input-label">
          <i className="fas fa-tag"></i>
          <span>Video URL</span>
        </div>
        <input
          type="url"
          placeholder="Video URL"
          value={newFavorite.url}
          onChange={(e) => setNewFavorite({ ...newFavorite, url: e.target.value })}
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