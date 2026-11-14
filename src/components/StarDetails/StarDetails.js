import { useState } from 'react';
import { useParams } from 'react-router-dom';
import EditStarDialog from './EditStarDialog/EditStarDialog';
import VideosPage from '../VideosPage/VideosPage';
import * as favoritesService from '../../services/favoritesService';
import { isSameStar } from '../../utils/starName';
import './StarDetails.css';

const tagList = (tags) => (Array.isArray(tags) ? tags : []);

/**
 * A single star's page. Video listing, adding and editing all live in
 * VideosPage — this component only resolves the star from the route and owns
 * the "edit star" dialog.
 */
const StarDetails = ({ stars = [], onStarsUpdate }) => {
  const { starName } = useParams();
  const [showEditStar, setShowEditStar] = useState(false);
  // Bumped when this star's videos change from here, so the list re-reads them.
  const [videosVersion, setVideosVersion] = useState(0);

  const starIndex = stars.findIndex((s) => isSameStar(s.Name, starName));
  const star = starIndex !== -1 ? stars[starIndex] : null;

  const handleEditSave = (updatedStar) => {
    // Tags added to the star go onto all of its videos; removed ones come off.
    const before = tagList(star.Tags);
    const after = tagList(updatedStar.Tags);
    const changed = favoritesService.retagStarVideos(star.Name, {
      add: after.filter((tag) => !before.includes(tag)),
      remove: before.filter((tag) => !after.includes(tag)),
    });
    if (changed) setVideosVersion((version) => version + 1);

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
          videoCount={favoritesService.listForStar(star.Name).length}
          onSave={handleEditSave}
          onCancel={() => setShowEditStar(false)}
        />
      )}

      <VideosPage
        starName={star.Name}
        starImage={star.Image_Link}
        starDataBase={star.Data_Base}
        starTags={star.Tags}
        dataVersion={videosVersion}
        onEditStar={() => setShowEditStar(true)}
      />
    </div>
  );
};

export default StarDetails;
