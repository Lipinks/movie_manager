import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AddStarDialog from './AddStarDialog/AddStarDialog';
import * as favoritesService from '../../services/favoritesService';
import * as starsService from '../../services/starsService';
import { shuffle } from '../../utils/arrayUtils';
import './StarManager.css';

const StarManager = ({ showAddStarModal, closeAddStarModal, updateStarDetails, stars }) => {
  const navigate = useNavigate();

  // Shuffling only changes what order the grid is displayed in — it never
  // touches `stars` itself, so nothing is persisted and add/delete/fetch all
  // keep working against the real (alphabetical) list. Re-sync whenever the
  // underlying roster changes, which also resets any shuffle back to A-Z.
  const [displayStars, setDisplayStars] = useState(stars);
  useEffect(() => {
    setDisplayStars(stars);
  }, [stars]);

  const handleSave = (newStar) => {
    updateStarDetails([...stars, newStar]);
    closeAddStarModal();
  };

  const handleDelete = (star) => {
    if (!window.confirm(`Are you sure you want to delete ${star.Name}? Their videos will be removed too.`)) {
      return;
    }

    // Match by identity, not array index — the grid can be showing a
    // shuffled order that no longer lines up with `stars`' own indices.
    updateStarDetails(stars.filter((s) => s.Name !== star.Name));
    favoritesService.removeStar(star.Name);
  };

  return (
    <div className="star-manager">
      {/* Floating over the header rather than inside it: these are page
          controls for the stars grid, not app-wide navigation. */}
      <div className="star-shuffle-controls">
        <button
          type="button"
          className="star-shuffle-btn"
          onClick={() => setDisplayStars((prev) => shuffle(prev))}
          title="Shuffle stars"
          aria-label="Shuffle stars"
        >
          🔀
        </button>
        <button
          type="button"
          className="star-shuffle-btn"
          onClick={() => setDisplayStars(starsService.sortByName(stars))}
          title="Sort alphabetically"
          aria-label="Sort stars alphabetically"
        >
          🔠
        </button>
      </div>

      {showAddStarModal && (
        <AddStarDialog
          onSave={handleSave}
          onCancel={closeAddStarModal}
          isDuplicateName={(name) => starsService.exists(stars, name)}
        />
      )}

      <div className="stars-grid">
        {displayStars.map((star) => (
          <div key={star.Name} className="star-frame">
            <div className="image-container">
              <img
                src={star.Image_Link}
                alt={star.Name}
                onClick={() => navigate(`/star/${encodeURIComponent(star.Name.toLowerCase())}`)}
                style={{ cursor: 'pointer' }}
              />
              <button
                onClick={() => handleDelete(star)}
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
