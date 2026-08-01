import { useNavigate } from 'react-router-dom';
import AddStarDialog from './AddStarDialog/AddStarDialog';
import * as favoritesService from '../../services/favoritesService';
import * as starsService from '../../services/starsService';
import './StarManager.css';

const StarManager = ({ showAddStarModal, closeAddStarModal, updateStarDetails, stars }) => {
  const navigate = useNavigate();

  const handleSave = (newStar) => {
    updateStarDetails([...stars, newStar]);
    closeAddStarModal();
  };

  const handleDelete = (index) => {
    const star = stars[index];
    if (!window.confirm(`Are you sure you want to delete ${star.Name}? Their videos will be removed too.`)) {
      return;
    }

    updateStarDetails(stars.filter((_, i) => i !== index));
    favoritesService.removeStar(star.Name);
  };

  return (
    <div className="star-manager">
      {showAddStarModal && (
        <AddStarDialog
          onSave={handleSave}
          onCancel={closeAddStarModal}
          isDuplicateName={(name) => starsService.exists(stars, name)}
        />
      )}

      <div className="stars-grid">
        {stars.map((star, index) => (
          <div key={star.Name} className="star-frame">
            <div className="image-container">
              <img
                src={star.Image_Link}
                alt={star.Name}
                onClick={() => navigate(`/star/${encodeURIComponent(star.Name.toLowerCase())}`)}
                style={{ cursor: 'pointer' }}
              />
              <button
                onClick={() => handleDelete(index)}
                className="delete-star-btn"
                aria-label={`Delete ${star.Name}`}
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
