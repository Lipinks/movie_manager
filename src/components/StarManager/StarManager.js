import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AddStarDialog from './AddStarDialog/AddStarDialog';
import * as storage from '../../utils/storage';
import './StarManager.css';

const StarManager = ({showAddStarModal, closeAddStarModal, updateStarDetails, stars }) => {
  
  const navigate = useNavigate();

  const [newStar, setNewStar] = useState({
    Name: '',
    Image_Link: '',
    Tags: [],
  });
  const [availableTags, setAvailableTags] = useState([]);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    setAvailableTags(storage.getItem(storage.KEYS.TAGS, []));
  }, []);

  const handleInputChange = (e) => {
    var { name, value } = e.target;
    setNewStar(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddTagToStar = (tag) => {
    if (tag && !newStar.Tags.includes(tag)) {
      setNewStar(prev => ({
        ...prev,
        Tags: [...prev.Tags, tag]
      }));
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setNewStar(prev => ({
      ...prev,
      Tags: prev.Tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleCreateNewTag = () => {
    if (newTag.trim() && !availableTags.includes(newTag.trim())) {
      var trimmedTag = newTag.trim();
      var updatedTags = [...availableTags, trimmedTag];
      setAvailableTags(updatedTags);
      
      storage.setItem(storage.KEYS.TAGS, updatedTags);
      
      setNewStar(prev => ({
        ...prev,
        Tags: [...prev.Tags, trimmedTag]
      }));
      
      setNewTag('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleCreateNewTag();
    }
  };

  const handleSave = () => {
    if (!newStar.Name || !newStar.Image_Link) {
      alert('Please fill all fields');
      return;
    }

    var updatedStars = [...stars, newStar];
    
    updateStarDetails(updatedStars);
    
    setNewStar({
      Name: '',
      Image_Link: '',
      Tags: []
    });

    closeAddStarModal();
  };

  const handleDelete = (index) => {
    var star = stars[index];
    var isConfirmed = window.confirm(`Are you sure you want to delete ${star.Name}?`);
    
    if (isConfirmed) {
      var newStars = stars.filter((_, i) => i !== index);
      updateStarDetails(newStars);
      //also delete videos associated with this star
      var favorites = storage.getItem(storage.KEYS.FAVORITES, {});
      delete favorites[star.Name.toLowerCase()];
      storage.setItem(storage.KEYS.FAVORITES, favorites);
    }
  };

  const handleImageClick = (star) => {
    navigate(`/star/${star.Name.toLowerCase()}`);
  };

  return (
    <div className="star-manager">
      {showAddStarModal && (
        <AddStarDialog 
          newStar={newStar}
          handleInputChange={handleInputChange}
          handleAddTagToStar={handleAddTagToStar}
          handleRemoveTag={handleRemoveTag}
          handleCreateNewTag={handleCreateNewTag}
          handleKeyPress={handleKeyPress}
          closeAddStarModal={closeAddStarModal}
          handleSave={handleSave}
          tags={availableTags}
          newTag={newTag}
          setNewTag={setNewTag} 
        />
      )}

      <div className="stars-grid">
        {stars.map((star, index) => (
          <div key={index} className="star-frame">
            <div className="image-container">
              <img 
                src={star.Image_Link} 
                alt={star.Name} 
                onClick={() => handleImageClick(star)}
                style={{ cursor: 'pointer' }}
              />
              <button 
                onClick={() => handleDelete(index)} 
                className="delete-star-btn"
                aria-label="Delete star"
                title="Delete star"
              >🚮
              </button>
            </div>
            <div className="star-info">
              <h3>{star.Name}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StarManager;
