import './AddStarDialog.css';

const AddStarDialog = ({newStar,handleInputChange,handleAddTagToStar,handleRemoveTag,handleCreateNewTag,handleKeyPress,closeAddStarModal,handleSave,tags,newTag,setNewTag})=> {
  return (
    <div className="add-star-overlay">
      <div className="add-star-dialog">
        <div className="name-input-section">
          <div className='add-new-star'>Add New Star</div>
          <input
            type="text"
            name="Name"
            placeholder="Name"
            value={newStar.Name}
            onChange={handleInputChange}

          />
          <input
            type="url"
            name="Image_Link"
            placeholder="Image Link"
            value={newStar.Image_Link}
            onChange={handleInputChange}
          />
        </div>
        
         
          
          <div className="create-new-tag">
            <button onClick={handleSave} className="save-btn">Save Star</button>
            <button onClick={closeAddStarModal} className="cancel-btn">Cancel</button>
          </div>
        </div>
      </div>
  );
};

export default AddStarDialog;