import './youtube.css';
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import * as youtubeService from '../../services/youtubeService';

// Memoized Video Card Component with click-to-play
const VideoCard = memo(({ url, index, onDelete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoId = youtubeService.getVideoId(url);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  return (
    <div className="yt-video-card">
      <button
        className="yt-delete-btn"
        onClick={() => onDelete(index)}
        title="Delete video"
        aria-label={`Delete video ${index + 1}`}
      >
        ×
      </button>
      {isPlaying ? (
        <iframe
          width="560"
          height="315"
          src={`${url}${url.includes('?') ? '&' : '?'}autoplay=1`}
          title={`YouTube video ${index + 1}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <div
          className="video-thumbnail"
          onClick={() => setIsPlaying(true)}
          role="button"
          tabIndex={0}
          aria-label={`Play video ${index + 1}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsPlaying(true);
            }
          }}
        >
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={`Video ${index + 1} thumbnail`} />
          ) : (
            <div className="thumbnail-placeholder">Click to play</div>
          )}
          <div className="play-button">
            <svg viewBox="0 0 68 48" width="68" height="48" aria-hidden="true">
              <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"></path>
              <path d="M 45,24 27,14 27,34" fill="#fff"></path>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
});

VideoCard.displayName = 'YoutubeVideoCard';

// Memoized Delete Confirmation Modal
const DeleteModal = memo(({ onCancel, onConfirm }) => (
  <div className="yt-delete-overlay">
    <div className="yt-delete-modal">
      <h3>Confirm Delete</h3>
      <p>Are you sure you want to delete this video?</p>
      <div className="yt-delete-buttons">
        <button onClick={onCancel} className="yt-cancel-btn">Cancel</button>
        <button onClick={onConfirm} className="yt-confirm-btn">Delete</button>
      </div>
    </div>
  </div>
));

DeleteModal.displayName = 'YoutubeDeleteModal';

export default function YoutubePage() {
  const [videos, setVideos] = useState([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setVideos(youtubeService.getVideos());
    setIsLoading(false);
  }, []);

  const handleAddVideo = useCallback(() => {
    const result = youtubeService.addVideo(newVideoUrl);
    if (result.error) {
      setError(result.error);
      return;
    }
    setVideos(result.videos);
    setNewVideoUrl('');
    setError('');
  }, [newVideoUrl]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') handleAddVideo();
    },
    [handleAddVideo]
  );

  const handleDeleteClick = useCallback((index) => setDeleteIndex(index), []);
  const cancelDelete = useCallback(() => setDeleteIndex(null), []);

  const confirmDelete = useCallback(() => {
    if (deleteIndex === null) return;
    setVideos(youtubeService.removeVideoAt(deleteIndex));
    setDeleteIndex(null);
  }, [deleteIndex]);

  const videosGrid = useMemo(() => {
    if (isLoading) return <p className="loading">Loading videos...</p>;
    if (videos.length === 0) {
      return <p className="no-videos">No videos added yet. Add your first video above!</p>;
    }

    return (
      <div className="yt-videos-grid">
        {videos.map((url, index) => (
          <VideoCard key={url} url={url} index={index} onDelete={handleDeleteClick} />
        ))}
      </div>
    );
  }, [videos, isLoading, handleDeleteClick]);

  return (
    <div className="youtube-page">
      <div className="add-video-section">
        <input
          type="text"
          placeholder="Enter YouTube URL or embed code..."
          value={newVideoUrl}
          onChange={(e) => {
            setNewVideoUrl(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={handleKeyDown}
          className="video-input"
          aria-label="YouTube video URL input"
        />
        <button onClick={handleAddVideo} className="add-button" disabled={!newVideoUrl.trim()}>
          Add Video
        </button>
      </div>

      {error && <p className="yt-error" role="alert">{error}</p>}

      {videosGrid}

      {deleteIndex !== null && <DeleteModal onCancel={cancelDelete} onConfirm={confirmDelete} />}
    </div>
  );
}
