import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './VideosPage.css';
import VideoDialog from '../common/VideoDialog';
import Dropdown from '../common/Dropdown';
import * as favoritesService from '../../services/favoritesService';
import * as starsService from '../../services/starsService';
import * as tagService from '../../services/tagService';
import { toStarKey, toDisplayName } from '../../utils/starName';

const sortOptions = [
  { value: 'creation', label: 'Creation Time' },
  { value: 'modification', label: 'Modified Time' },
];

const orderOptions = [
  { value: 'new', label: 'Newest First' },
  { value: 'old', label: 'Oldest First' },
];

const byName = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });

const shuffle = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Video browser, used both as the standalone /videos page (starName === '')
 * and embedded in a star's page (starName set). All reads and writes go
 * through favoritesService so the storage shape lives in exactly one place.
 */
const VideosPage = ({ starName = '', starImage, onEditStar }) => {
  const isMainVideosTab = starName === '';

  const [videos, setVideos] = useState([]);
  const [availableTags, setAvailableTags] = useState(() => tagService.getTags());
  // The full roster, so stars with zero videos still appear in the sidebar
  // and in the add-video star picker.
  const [roster] = useState(() => starsService.getStars());

  const [selectedTag, setSelectedTag] = useState('');
  const [selectedSort, setSelectedSort] = useState('');
  const [selectedOrder, setSelectedOrder] = useState('new');
  const [selectedStar, setSelectedStar] = useState('');
  const [starSearch, setStarSearch] = useState('');

  const [editingVideo, setEditingVideo] = useState(null);
  const [showAddVideo, setShowAddVideo] = useState(false);

  const reload = useCallback(() => {
    setVideos(isMainVideosTab ? favoritesService.listAll() : favoritesService.listForStar(starName));
    setAvailableTags(tagService.getTags());
  }, [isMainVideosTab, starName]);

  useEffect(() => {
    reload();
  }, [reload]);

  /* ---------------------------------------------------------------- *
   * Derived data
   * ---------------------------------------------------------------- */

  const videoCountByStar = useMemo(
    () =>
      videos.reduce((counts, video) => {
        counts[video.starName] = (counts[video.starName] || 0) + 1;
        return counts;
      }, {}),
    [videos]
  );

  // Roster first, then any star that still owns videos but has left the
  // roster, so no video can become unreachable.
  const starNames = useMemo(() => {
    const names = new Set(roster.map((star) => toStarKey(star.Name)));
    videos.forEach((video) => names.add(video.starName));
    return [...names].sort(byName);
  }, [roster, videos]);

  const filteredStarNames = useMemo(() => {
    const query = starSearch.trim().toLowerCase();
    return query ? starNames.filter((name) => name.includes(query)) : starNames;
  }, [starNames, starSearch]);

  const filterOptions = useMemo(
    () => [{ value: '', label: 'All Categories' }, ...availableTags.map((tag) => ({ value: tag, label: tag }))],
    [availableTags]
  );

  const starSelectOptions = useMemo(
    () => roster.map((star) => ({ value: star.Name, label: star.Name })),
    [roster]
  );

  const filteredFavorites = useMemo(() => {
    let result = videos;

    if (isMainVideosTab && selectedStar) {
      result = result.filter((favorite) => favorite.starName === selectedStar);
    }
    if (selectedTag) {
      result = result.filter((favorite) => favorite.tags?.includes(selectedTag));
    }
    if (selectedSort) {
      result = [...result].sort((a, b) => {
        const dateA = new Date(selectedSort === 'creation' ? a.creation : a.modification) || 0;
        const dateB = new Date(selectedSort === 'creation' ? b.creation : b.modification) || 0;
        return selectedOrder === 'new' ? dateB - dateA : dateA - dateB;
      });
    }

    return result;
  }, [videos, isMainVideosTab, selectedStar, selectedTag, selectedSort, selectedOrder]);

  /* ---------------------------------------------------------------- *
   * Mutations
   * ---------------------------------------------------------------- */

  const handleCreateTag = useCallback((tag) => {
    setAvailableTags(tagService.addTag(tag));
  }, []);

  const handleAddVideo = (video) => {
    const { starName: pickedStar, ...fields } = video;
    favoritesService.add(isMainVideosTab ? pickedStar : starName, fields);
    setShowAddVideo(false);
    reload();
  };

  const handleUpdateVideo = (video) => {
    favoritesService.update(editingVideo.starName, editingVideo.id, video);
    setEditingVideo(null);
    reload();
  };

  const handleDeleteVideo = (video) => {
    if (!window.confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }
    favoritesService.remove(video.starName, video.id);
    reload();
  };

  const handleTagClick = useCallback((tag) => setSelectedTag(tag), []);
  const handleStarSelect = useCallback(
    (name) => setSelectedStar((prev) => (prev === name ? '' : name)),
    []
  );

  /* ---------------------------------------------------------------- *
   * Render
   * ---------------------------------------------------------------- */

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
        onClick={() => setVideos((current) => shuffle(current))}
        title="Shuffle videos"
      >🔀 Shuffle</button>
    </>
  );

  return (
    <div className={`videos-page with-sidebar ${isMainVideosTab ? 'with-header-padding' : ''}`}>
      {!isMainVideosTab && starImage && (
        <div
          className="videos-bg"
          style={{ backgroundImage: `url("${starImage}")` }}
          aria-hidden="true"
        />
      )}

      <aside className="videos-left-sidebar">
        {!isMainVideosTab && starImage && (
          <div className="sidebar-star-profile">
            <div className="sidebar-star-image">
              <img src={starImage} alt={starName} />
            </div>
            <h2 className="sidebar-star-name">{starName}</h2>
            <div className="sidebar-star-actions">
              <button className="sidebar-action-btn sidebar-add-vid-btn" onClick={() => setShowAddVideo(true)}>
                📺 Add Video
              </button>
              <button className="sidebar-action-btn sidebar-edit-star-btn" onClick={onEditStar}>
                ✂️ Edit Star
              </button>
            </div>
          </div>
        )}

        {isMainVideosTab && (
          <div className="sidebar-add-video-section">
            <button className="sidebar-action-btn sidebar-add-vid-btn" onClick={() => setShowAddVideo(true)}>
              📺 Add Video
            </button>
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
                aria-label="Search stars"
              />
              {starSearch && (
                <button className="star-search-clear" onClick={() => setStarSearch('')} aria-label="Clear search">×</button>
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
                  <span className="star-video-count">{videoCountByStar[name] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div
        className="videos-main-content"
        style={
          !isMainVideosTab
            ? {
                backgroundImage: `linear-gradient(rgba(255,255,255,0.2), rgba(255,255,255,0.2)), url(${starImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                minHeight: '100vh',
              }
            : {}
        }
      >
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
                onEdit={() => setEditingVideo(favorite)}
                onDelete={() => handleDeleteVideo(favorite)}
              />
            ))}
          </div>
        )}
      </div>

      {showAddVideo && (
        <VideoDialog
          title="Add New Video"
          saveLabel="Save"
          tags={availableTags}
          onCreateTag={handleCreateTag}
          onSave={handleAddVideo}
          onCancel={() => setShowAddVideo(false)}
          starOptions={isMainVideosTab ? starSelectOptions : null}
        />
      )}

      {editingVideo && (
        <VideoDialog
          key={editingVideo.id}
          title="Edit Video"
          saveLabel="Save Changes"
          initialValue={editingVideo}
          tags={availableTags}
          onCreateTag={handleCreateTag}
          onSave={handleUpdateVideo}
          onCancel={() => setEditingVideo(null)}
        />
      )}
    </div>
  );
};

const VideoCard = React.memo(({ favorite, selectedTag, onTagClick, onEdit, onDelete }) => (
  <div className="video-card">
    <div className="card-actions">
      <button className="action-btn edit-btn" onClick={onEdit} title="Edit video" aria-label="Edit video">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      <button className="action-btn delete-btn" onClick={onDelete} title="Delete video" aria-label="Delete video">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="3,6 5,6 21,6"></polyline>
          <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
    </div>

    {favorite.videoDuration && <div className="video-duration-tag">{favorite.videoDuration}</div>}
    {favorite.isVPN && <div className="video-vpn-tag">VPN</div>}

    <div className="card-image">
      <img
        src={favorite.imageUrl}
        alt={favorite.name}
        loading="lazy"
        onClick={() => window.open(favorite.url, '_blank', 'noopener,noreferrer')}
      />
    </div>

    <div className="card-content">
      <h3 className="video-name">{favorite.name}</h3>
      <a className="star-name" href={`#/star/${encodeURIComponent(favorite.starName)}`}>
        {toDisplayName(favorite.starName)}
      </a>

      {favorite.tags?.length > 0 && (
        <div className="video-tags-container">
          <div className="video-tags">
            {favorite.tags.map((tag) => (
              <span
                key={tag}
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
