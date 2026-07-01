import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './VideosPage.css';
import EditVidDialog from './EditVidDialog/EditVidDialog';
import Dropdown from '../common/Dropdown';
import * as storage from '../../utils/storage';

const sortOptions = [
  { value: 'creation', label: 'Creation Time' },
  { value: 'modification', label: 'Modified Time' },
];

const orderOptions = [
  { value: 'new', label: 'Newest First' },
  { value: 'old', label: 'Oldest First' },
];

const VideosPage = ({ starName, starImage, onAddVideo, onEditStar, reloadKey }) => {

  const [videos, setVideos] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [editingVideo, setEditingVideo] = useState(null);
  const [showEditVidModal, setShowEditVidModal] = useState(false);
  const [selectedSort, setSelectedSort] = useState('');
  const [selectedOrder, setSelectedOrder] = useState('new');
  const [selectedStar, setSelectedStar] = useState('');
  const [starNames, setStarNames] = useState([]);
  const [starSearch, setStarSearch] = useState('');

  // Shuffle array function
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  useEffect(() => {
    const loadData = () => {
      const videosData = storage.getItem(storage.KEYS.FAVORITES, null);
      const tagsData = storage.getItem(storage.KEYS.TAGS, null);

      if (videosData) {
        let flattened = [];
        if (starName === '') {
          // Extract star names that have videos
          const names = Object.keys(videosData)
            .filter(name => videosData[name] && videosData[name].length > 0)
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
          setStarNames(names);

          flattened = Object.entries(videosData).flatMap(([name, favorites]) =>
            favorites.map(favorite => ({ ...favorite, starName: name }))
          );
        } else {
          const starNameLowerCase = starName.toLowerCase();
          flattened = (videosData[starNameLowerCase] || []).map(favorite => ({ ...favorite, starName: starNameLowerCase }));
        }
        setVideos(flattened);
      }

      if (Array.isArray(tagsData)) {
        setAvailableTags(tagsData.sort());
      }
    };
    loadData();
  }, [starName, reloadKey]);

  const handleShuffle = () => {
    setVideos(shuffleArray(videos));
  };

  // Filter and sort videos based on selected star, tag and sort option.
  const filteredFavorites = useMemo(() => {
    let result = videos;

    // Apply star filter (only on main videos tab)
    if (starName === '' && selectedStar) {
      result = result.filter(favorite => favorite.starName === selectedStar);
    }

    // Apply tag filter
    if (selectedTag) {
      result = result.filter(favorite => favorite.tags?.includes(selectedTag));
    }

    // Apply sorting
    if (selectedSort) {
      result = [...result].sort((a, b) => {
        const dateA = new Date(selectedSort === 'creation' ? a.creation : a.modification) || 0;
        const dateB = new Date(selectedSort === 'creation' ? b.creation : b.modification) || 0;
        return selectedOrder === 'new' ? dateB - dateA : dateA - dateB;
      });
    }

    return result;
  }, [selectedTag, selectedSort, selectedOrder, selectedStar, starName, videos]);

  const handleTagClick = useCallback((tag) => {
    setSelectedTag(tag);
  }, []);

  const handleEditVideo = (favId, updatedData, videoStarName) => {
    const updatedVideos = videos.map(fav =>
      fav.id === favId ? { ...fav, ...updatedData } : fav
    );
    setVideos(updatedVideos);

    // Get the current favorites from cache
    const currentFavs = storage.getItem(storage.KEYS.FAVORITES, {});

    // Get only the videos for this specific star and update the matching one
    const starFavorites = currentFavs[videoStarName.toLowerCase()] || [];
    currentFavs[videoStarName.toLowerCase()] = starFavorites.map(fav =>
      fav.id === favId ? { ...fav, ...updatedData } : fav
    );
    storage.setItem(storage.KEYS.FAVORITES, currentFavs);

    setEditingVideo(null);
    setShowEditVidModal(false);
  };

  const handleDeleteFavorite = (id, videoStarName) => {
    if (window.confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      // Update the videos state (flattened array) for UI
      setVideos(videos.filter(fav => fav.id !== id));

      // Get the current favorites from cache and remove the matching one
      const currentFavs = storage.getItem(storage.KEYS.FAVORITES, {});
      const starFavorites = currentFavs[videoStarName.toLowerCase()] || [];
      currentFavs[videoStarName.toLowerCase()] = starFavorites.filter(fav => fav.id !== id);
      storage.setItem(storage.KEYS.FAVORITES, currentFavs);
    }
  };

  const filteredStarNames = useMemo(() => {
    if (!starSearch.trim()) return starNames;
    return starNames.filter(name => name.toLowerCase().includes(starSearch.toLowerCase()));
  }, [starNames, starSearch]);

  const handleStarSelect = useCallback((name) => {
    setSelectedStar(prev => prev === name ? '' : name);
  }, []);

  const isMainVideosTab = starName === '';

  const filterOptions = useMemo(
    () => [{ value: '', label: 'All Categories' }, ...availableTags.map(tag => ({ value: tag, label: tag }))],
    [availableTags]
  );

  // Filter/Sort/Order controls (shared between sidebar and inline)
  const renderFilterControls = () => (
    <>
      <div className="sidebar-control-group">
        <label className="filter-label">Filter by Category:</label>
        <Dropdown value={selectedTag} options={filterOptions} onSelect={setSelectedTag} />
      </div>

      <div className="sidebar-control-group">
        <label className="filter-label">Sort by:</label>
        <Dropdown value={selectedSort} options={sortOptions} onSelect={setSelectedSort} placeholder="None" />
      </div>

      <div className="sidebar-control-group">
        <label className="filter-label">Order:</label>
        <Dropdown value={selectedOrder} options={orderOptions} onSelect={setSelectedOrder} />
      </div>

      <button
        className="shuffle-button"
        onClick={handleShuffle}
        title="Shuffle videos"
      >🔀 Shuffle</button>
    </>
  );

  const renderVideoContent = () => (
    <>
      {filteredFavorites.length === 0 ? (
        <p className="no-data">
          {selectedStar
            ? `No videos found for "${selectedStar}"`
            : selectedTag
            ? `No videos found for category "${selectedTag}"`
            : 'No videos found'}
        </p>
      ) : (
        <div className="videos-grid">
          {filteredFavorites.map((favorite) => (
            <VideoCard
              key={`${favorite.starName}-${favorite.id}`}
              favorite={favorite}
              selectedTag={selectedTag}
              onTagClick={handleTagClick}
              onEdit={() => {
                setEditingVideo(favorite);
                setShowEditVidModal(true);
              }}
              onDelete={() => handleDeleteFavorite(favorite.id, favorite.starName)}
            />
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className={`videos-page with-sidebar ${isMainVideosTab ? 'with-header-padding' : ''}`}>
      <aside className="videos-left-sidebar">
        {!isMainVideosTab && starImage && (
          <div className="sidebar-star-profile">
            <div className="sidebar-star-image">
              <img src={starImage} alt={starName} />
            </div>
            <h2 className="sidebar-star-name">{starName}</h2>
            <div className="sidebar-star-actions">
              <button className="sidebar-action-btn sidebar-add-vid-btn" onClick={onAddVideo}>
                📺 Add Video
              </button>
              <button className="sidebar-action-btn sidebar-edit-star-btn" onClick={onEditStar}>
                ✂️ Edit Star
              </button>
            </div>
          </div>
        )}
        <div className="sidebar-controls-section">
          <h3 className="sidebar-section-title">Controls</h3>
          {renderFilterControls()}
        </div>
        {isMainVideosTab && (
          <div className="sidebar-stars-section">
            <h3 className="sidebar-section-title">Stars ({starNames.length})</h3>
            <div className="sidebar-star-search">
              <input
                type="text"
                placeholder="Search stars..."
                value={starSearch}
                onChange={(e) => setStarSearch(e.target.value)}
                className="star-search-input"
              />
              {starSearch && (
                <button className="star-search-clear" onClick={() => setStarSearch('')}>×</button>
              )}
            </div>
            <div
              className={`sidebar-star-item all-stars ${selectedStar === '' ? 'active' : ''}`}
              onClick={() => setSelectedStar('')}
            >
              All Stars
              <span className="star-video-count">{videos.length}</span>
            </div>
            <div className="sidebar-star-list">
              {filteredStarNames.map((name) => (
                <div
                  key={name}
                  className={`sidebar-star-item ${selectedStar === name ? 'active' : ''}`}
                  onClick={() => handleStarSelect(name)}
                  title={name}
                >
                  <span className="star-item-name">{name}</span>
                  <span className="star-video-count">
                    {videos.filter(v => v.starName === name).length}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className="videos-main-content">
        {renderVideoContent()}
      </div>

      {editingVideo && showEditVidModal && (
        <div className="edit-vid-overlay">
          <div className="edit-vid-dialog">
            <EditVidDialog
              editingVideo={editingVideo}
              handleEditFavorite={handleEditVideo}
              setEditingVideo={() => {
                setEditingVideo(null);
                setShowEditVidModal(false);
              }}
              tags={availableTags}
              handleCreateNewTag={(newTag) => {
                if (newTag.trim() && !availableTags.includes(newTag.trim())) {
                  const updatedTags = [...availableTags, newTag.trim()];
                  setAvailableTags(updatedTags);
                  storage.setItem(storage.KEYS.TAGS, updatedTags);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const VideoCard = React.memo(({ favorite, selectedTag, onTagClick, onEdit, onDelete }) => (
  <div className="video-card">
    <div className="card-actions">
      <button className="action-btn edit-btn" onClick={onEdit} title="Edit video">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      <button className="action-btn delete-btn" onClick={onDelete} title="Delete video">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3,6 5,6 21,6"></polyline>
          <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
    </div>
    {favorite.videoDuration && (
      <div className="video-duration-tag">
        {favorite.videoDuration}
      </div>
    )}
    {favorite.isVPN && (
      <div className="video-vpn-tag">
        VPN
      </div>
    )}
    <div className="card-image">
      <img
        src={favorite.imageUrl}
        alt={favorite.name}
        loading="lazy"
        onClick={() => window.open(favorite.url, '_blank')}
      />
    </div>
    <div className="card-content">
      <h3 className="video-name">{favorite.name}</h3>
      <a className="star-name" href={`#/star/${encodeURIComponent(favorite.starName)}`}>
        {favorite.starName.charAt(0).toUpperCase() + favorite.starName.slice(1)}
      </a>

      {favorite.tags?.length > 0 && (
        <div className="video-tags-container">
          <div className="video-tags">
            {favorite.tags.map((tag, index) => (
              <span
                key={index}
                className={`video-tag ${selectedTag === tag ? 'highlighted' : ''}`}
                onClick={() => onTagClick(tag)}
                title="Click to filter by this tag"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
));

VideoCard.displayName = 'VideoCard';

export default VideosPage;
