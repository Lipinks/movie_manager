import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AddStarDialog from './AddStarDialog/AddStarDialog';
import Icon from '../common/Icon';
import { HeaderPageActions } from '../Header/headerSlot';
import * as favoritesService from '../../services/favoritesService';
import * as starsService from '../../services/starsService';
import { toStarKey, isSameStar } from '../../utils/starName';
import { shuffle } from '../../utils/arrayUtils';
import './StarManager.css';

/** Up to two initials, for a star whose photo can't be shown. */
const initialsOf = (name) =>
  String(name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');

/**
 * One star in the grid. The whole card opens the star (the delete button
 * keeps its own action), and a photo that fails to load shows the star's
 * initials across the image area instead of a stray alt text in its corner.
 */
const StarCard = ({ star, onOpen, onDelete }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(star.Image_Link) && !imageFailed;

  return (
    <div
      className="star-frame"
      role="link"
      tabIndex={0}
      onClick={(event) => {
        if (!event.target.closest('button')) onOpen(star);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(star);
      }}
    >
      <div className="image-container">
        {showImage ? (
          // Lazy: only photos near the screen download, not the whole roster.
          <img
            src={star.Image_Link}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="star-image-fallback" aria-hidden="true">
            {initialsOf(star.Name)}
          </div>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="delete-star-btn"
          aria-label={`Delete ${star.Name}`}
          title="Delete star"
        >
          🚮
        </button>
      </div>
      <div className="star-info">
        <h3>{star.Name}</h3>
      </div>
    </div>
  );
};

const byStarName = (a, b) =>
  String(a.star?.Name ?? '').localeCompare(String(b.star?.Name ?? ''), undefined, { sensitivity: 'base' });

const StarManager = ({ updateStarDetails, stars }) => {
  const navigate = useNavigate();
  const [showAddStar, setShowAddStar] = useState(false);

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

  const openStar = (star) => navigate(`/star/${encodeURIComponent(toStarKey(star.Name))}`);

  const handleSave = (newStar) => {
    updateStarDetails([...stars, newStar]);
    setShowAddStar(false);
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
      {/* The grid's own controls, shown in the header while this page is open. */}
      <HeaderPageActions>
        <button
          type="button"
          className="header-btn"
          onClick={() => setShowAddStar(true)}
          aria-label="Add star"
          data-tooltip="Add star"
        >
          <Icon name="user-plus" />
        </button>
        <button
          type="button"
          className="header-btn"
          onClick={() => setDisplayStars((prev) => shuffle(prev))}
          aria-label="Shuffle stars"
          data-tooltip="Shuffle"
        >
          <Icon name="shuffle" />
        </button>
        <button
          type="button"
          className="header-btn"
          onClick={() => setDisplayStars(alphabetical)}
          aria-label="Sort stars alphabetically"
          data-tooltip="Sort A–Z"
        >
          <Icon name="sort" />
        </button>
      </HeaderPageActions>

      {showAddStar && (
        <AddStarDialog
          onSave={handleSave}
          onCancel={() => setShowAddStar(false)}
          isDuplicateName={(name) => starsService.exists(stars, name)}
        />
      )}

      <div className="stars-grid">
        {displayStars.map((entry) => (
          <StarCard
            key={entry.key}
            star={entry.star}
            onOpen={openStar}
            onDelete={() => handleDelete(entry)}
          />
        ))}
      </div>
    </div>
  );
};

export default StarManager;
