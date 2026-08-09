import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AddStarDialog from './AddStarDialog/AddStarDialog';
import * as favoritesService from '../../services/favoritesService';
import * as starsService from '../../services/starsService';
import { toStarKey, isSameStar } from '../../utils/starName';
import { shuffle } from '../../utils/arrayUtils';
import './StarManager.css';

const byStarName = (a, b) =>
  String(a.star?.Name ?? '').localeCompare(String(b.star?.Name ?? ''), undefined, { sensitivity: 'base' });

const StarManager = ({ showAddStarModal, closeAddStarModal, updateStarDetails, stars }) => {
  const navigate = useNavigate();

  // A star's Name is NOT guaranteed unique — nothing enforced it before the
  // add dialog gained its duplicate check, and older data can still carry
  // repeats. So Name cannot be the React key: reordering a list that has
  // duplicate keys makes React clone and drop cards (the grid visibly grew
  // 6 → 13 cards on repeated shuffles). Pair each star with its position in
  // the canonical array instead — unique, and it stays attached to the star
  // as the display order changes.
  const keyedStars = useMemo(
    () => stars.map((star, index) => ({ star, index, key: `${index}:${star?.Name ?? ''}` })),
    [stars]
  );

  const alphabetical = useMemo(() => [...keyedStars].sort(byStarName), [keyedStars]);

  // Display order only. `stars` itself is never reordered, so nothing is
  // persisted and add/delete/fetch keep working against the real list.
  const [displayStars, setDisplayStars] = useState(alphabetical);
  useEffect(() => {
    setDisplayStars(alphabetical);
  }, [alphabetical]);

  const handleSave = (newStar) => {
    updateStarDetails([...stars, newStar]);
    closeAddStarModal();
  };

  const handleDelete = ({ star, index }) => {
    if (!window.confirm(`Are you sure you want to delete ${star.Name}? Their videos will be removed too.`)) {
      return;
    }

    // Remove by position, not by name: the grid may be showing a shuffled
    // order, and a name can be shared by more than one star.
    const remaining = stars.filter((_, i) => i !== index);
    updateStarDetails(remaining);

    // Videos are filed under the star's name, so a same-named star that is
    // still in the roster would lose its videos too. Only clear the bucket
    // once no star is using that name any more.
    if (!remaining.some((s) => isSameStar(s.Name, star.Name))) {
      favoritesService.removeStar(star.Name);
    }
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
          onClick={() => setDisplayStars(alphabetical)}
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
        {displayStars.map((entry) => (
          <div key={entry.key} className="star-frame">
            <div className="image-container">
              <img
                src={entry.star.Image_Link}
                alt={entry.star.Name}
                onClick={() => navigate(`/star/${encodeURIComponent(toStarKey(entry.star.Name))}`)}
                style={{ cursor: 'pointer' }}
              />
              <button
                onClick={() => handleDelete(entry)}
                className="delete-star-btn"
                aria-label={`Delete ${entry.star.Name}`}
                title="Delete star"
              >🚮
              </button>
            </div>
            <div className="star-info">
              <h3>{entry.star.Name}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StarManager;
