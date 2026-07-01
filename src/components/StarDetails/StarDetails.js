import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import AddVidDialog from './AddVidDialog/AddVidDialog';
import EditStarDialog from './EditStarDialog/EditStarDialog';
import VideosPage from '../VideosPage/VideosPage';
import * as storage from '../../utils/storage';
import { nowInIST } from '../../utils/dateUtils';
import './StarDetails.css';

const StarDetails = ({ stars = [], onStarsUpdate }) => {
  const { starName } = useParams();

  // Ensure stars is an array before using findIndex
  const starIndex = Array.isArray(stars) ? stars.findIndex(s => s.Name.toLowerCase() === starName.toLowerCase()) : -1;
  const star = starIndex !== -1 ? stars[starIndex] : null;

  const [editedStar, setEditedStar] = useState(star || { Name: '', Image_Link: '', Tags: [] });
  const [availableTags, setAvailableTags] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [newFavorite, setNewFavorite] = useState({ name: '', imageUrl: '', url: '' });
  const [showVidEditModal, setShowVidEditModal] = useState(false);
  const [showVidsModal, setShowVidAddModal] = useState(false);
  // Bumped after adding a video so the embedded VideosPage re-reads storage
  // (replaces the old full-page window.location.reload()).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const allFavorites = storage.getItem(storage.KEYS.FAVORITES, {});
    setFavorites(allFavorites[starName] || []);

    const globalTags = storage.getItem(storage.KEYS.TAGS, []);
    setAvailableTags(Array.isArray(globalTags) ? globalTags : []);
  }, [starName]);

  useEffect(() => {
    // Keep the edit form in sync with the resolved star, guaranteeing a Tags array.
    setEditedStar(star ? { ...star, Tags: Array.isArray(star.Tags) ? star.Tags : [] } : { Name: '', Image_Link: '', Tags: [] });
  }, [star]);

  const handleAddTagToStar = (tag) => {
    setEditedStar(prev => {
      const existing = Array.isArray(prev.Tags) ? prev.Tags : [];
      return existing.includes(tag) ? prev : { ...prev, Tags: [...existing, tag] };
    });
  };

  const handleRemoveTagFromStar = (tag) => {
    setEditedStar(prev => ({
      ...prev,
      Tags: (Array.isArray(prev.Tags) ? prev.Tags : []).filter(t => t !== tag),
    }));
  };

  const handleCreateNewTag = (tag) => {
    if (!availableTags.includes(tag)) {
      const updatedAvail = [...availableTags, tag];
      setAvailableTags(updatedAvail);
      storage.setItem(storage.KEYS.TAGS, updatedAvail);
    }
    handleAddTagToStar(tag);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedStar(prev => ({ ...prev, [name]: value }));
  };

  const handleEditSave = () => {
    // The Name field is read-only in the dialog, so only Image_Link / Tags change.
    const updatedStars = [...stars];
    updatedStars[starIndex] = editedStar;
    onStarsUpdate(updatedStars);
    storage.setItem(storage.KEYS.STARS, updatedStars);
    setShowVidEditModal(false);
  };

  const handleAddFavorite = () => {
    if (!newFavorite.name || !newFavorite.imageUrl) {
      alert('Please fill in name and image URL');
      return;
    }

    const favorite = {
      ...newFavorite,
      id: Date.now(),
      tags: newFavorite.tags || [],
      creation: nowInIST(),
    };

    const updatedFavorites = [...favorites, favorite];
    const currentFavs = storage.getItem(storage.KEYS.FAVORITES, {});
    currentFavs[starName] = updatedFavorites;
    storage.setItem(storage.KEYS.FAVORITES, currentFavs);
    setFavorites(updatedFavorites);
    setNewFavorite({ name: '', imageUrl: '', url: '', tags: [] });
    setShowVidAddModal(false);
    setReloadKey(k => k + 1);
  };

  if (!star) {
    return <div className="star-details">Star not found</div>;
  }

  return (
    <div className="star-details">
      {showVidEditModal && (
        <EditStarDialog
          editedStar={editedStar}
          handleInputChange={handleInputChange}
          handleEditSave={handleEditSave}
          setShowVidEditModal={setShowVidEditModal}
          handleAddTagToStar={handleAddTagToStar}
          handleRemoveTagFromStar={handleRemoveTagFromStar}
          handleCreateNewTag={handleCreateNewTag}
          availableTags={availableTags}
        />
      )}

      {showVidsModal && (
        <AddVidDialog
          newFavorite={newFavorite}
          setNewFavorite={setNewFavorite}
          handleAddFavorite={handleAddFavorite}
          setShowVidAddModal={setShowVidAddModal} />
      )}

      <VideosPage
        starName={star.Name}
        starImage={star.Image_Link}
        reloadKey={reloadKey}
        onAddVideo={() => setShowVidAddModal(true)}
        onEditStar={() => setShowVidEditModal(true)}
      />
    </div>
  );
};

export default StarDetails;
