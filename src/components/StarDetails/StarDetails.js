import { useState } from 'react';
import { useParams } from 'react-router-dom';
import EditStarDialog from './EditStarDialog/EditStarDialog';
import VideosPage from '../VideosPage/VideosPage';
import { isSameStar } from '../../utils/starName';
import './StarDetails.css';

/**
 * A single star's page. Video listing, adding and editing all live in
 * VideosPage — this component only resolves the star from the route and owns
 * the "edit star" dialog.
 */
const StarDetails = ({ stars = [], onStarsUpdate }) => {
  const { starName } = useParams();
  const [showEditStar, setShowEditStar] = useState(false);

  const starIndex = stars.findIndex((s) => isSameStar(s.Name, starName));
  const star = starIndex !== -1 ? stars[starIndex] : null;

  const handleEditSave = (updatedStar) => {
    const updatedStars = [...stars];
    updatedStars[starIndex] = updatedStar;
    // App owns persistence — writing here as well used to double-save.
    onStarsUpdate(updatedStars);
    setShowEditStar(false);
  };

  if (!star) {
    return <div className="star-details">Star not found</div>;
  }

  return (
    <div className="star-details">
      {showEditStar && (
        <EditStarDialog
          star={star}
          onSave={handleEditSave}
          onCancel={() => setShowEditStar(false)}
        />
      )}

      <VideosPage
        starName={star.Name}
        starImage={star.Image_Link}
        onEditStar={() => setShowEditStar(true)}
      />
    </div>
  );
};

export default StarDetails;
