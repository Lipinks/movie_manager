import './youtube.css';
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import * as storage from '../../utils/storage';

// Extract video ID from YouTube embed URL
const getVideoId = (url) => {
  const match = url.match(/embed\/([^?]+)/);
  return match ? match[1] : null;
};

// Memoized Video Card Component with click-to-play
const VideoCard = memo(({ url, index, onDelete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoId = getVideoId(url);
  const thumbnailUrl = videoId 
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

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
        <div className="video-thumbnail" onClick={() => setIsPlaying(true)}>
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={`Video ${index + 1} thumbnail`} />
          ) : (
            <div className="thumbnail-placeholder">Click to play</div>
          )}
          <div className="play-button">
            <svg viewBox="0 0 68 48" width="68" height="48">
              <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"></path>
              <path d="M 45,24 27,14 27,34" fill="#fff"></path>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
});

// Memoized Delete Confirmation Modal
const DeleteModal = memo(({ onCancel, onConfirm }) => (
  <div className="yt-delete-overlay">
    <div className="yt-delete-modal">
      <h3>Confirm Delete</h3>
      <p>Are you sure you want to delete this video?</p>
      <div className="yt-delete-buttons">
        <button onClick={onCancel} className="yt-cancel-btn">
          Cancel
        </button>
        <button onClick={onConfirm} className="yt-confirm-btn">
          Delete
        </button>
      </div>
    </div>
  </div>
));

// Main Component
export default function YoutubePage() {
  const [videos, setVideos] = useState([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [deleteIndex, setDeleteIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load videos from localStorage on mount
  useEffect(() => {
    try {
      const storedVideos = storage.getItem(storage.KEYS.YOUTUBE, null);
      if (storedVideos && Array.isArray(storedVideos)) {
        setVideos(storedVideos);
      }
    } catch (e) {
      console.error('Error loading videos:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Optimized URL extraction
  const extractSrc = useCallback((input) => {
    const trimmed = input.trim();
    
    // Handle iframe tags
    if (trimmed.startsWith('<iframe')) {
      const srcMatch = trimmed.match(/src=["']([^"']+)["']/);
      return srcMatch?.[1] || trimmed;
    }
    
    // Handle regular YouTube URLs
    if (trimmed.includes('youtube.com/watch?v=')) {
      const videoId = trimmed.match(/v=([^&]+)/)?.[1];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : trimmed;
    }
    
    return trimmed;
  }, []);

  // Validate YouTube URL
  const isValidYouTubeUrl = useCallback((url) => {
    return url.includes('youtube.com/embed/') || 
           url.includes('youtu.be/') ||
           url.startsWith('https://www.youtube.com/embed/');
  }, []);

  // Optimized add video handler
  const handleAddVideo = useCallback(() => {
    const trimmedUrl = newVideoUrl.trim();
    if (!trimmedUrl) return;

    const extractedUrl = extractSrc(trimmedUrl);
    
    if (!isValidYouTubeUrl(extractedUrl)) {
      alert('Please enter a valid YouTube embed URL');
      return;
    }

    // Check for duplicates
    if (videos.includes(extractedUrl)) {
      alert('This video is already in your collection');
      return;
    }

    setVideos(prev => {
      const updatedVideos = [...prev, extractedUrl];
      storage.setItem(storage.KEYS.YOUTUBE, updatedVideos);
      return updatedVideos;
    });
    
    setNewVideoUrl('');
  }, [newVideoUrl, videos, extractSrc, isValidYouTubeUrl]);

  // Optimized keyboard handler
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleAddVideo();
    }
  }, [handleAddVideo]);

  // Optimized delete handlers
  const handleDeleteClick = useCallback((index) => {
    setDeleteIndex(index);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteIndex === null) return;

    setVideos(prev => {
      const updatedVideos = prev.filter((_, i) => i !== deleteIndex);
      storage.setItem(storage.KEYS.YOUTUBE, updatedVideos);
      return updatedVideos;
    });
    
    setDeleteIndex(null);
  }, [deleteIndex]);

  const cancelDelete = useCallback(() => {
    setDeleteIndex(null);
  }, []);

  // Memoized videos grid
  const videosGrid = useMemo(() => {
    if (isLoading) {
      return <p className="loading">Loading videos...</p>;
    }

    if (videos.length === 0) {
      return <p className="no-videos">No videos added yet. Add your first video above!</p>;
    }

    return (
      <div className="yt-videos-grid">
        {videos.map((url, index) => (
          <VideoCard
            key={`${url}-${index}`}
            url={url}
            index={index}
            onDelete={handleDeleteClick}
          />
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
          onChange={(e) => setNewVideoUrl(e.target.value)}
          onKeyPress={handleKeyPress}
          className="video-input"
          aria-label="YouTube video URL input"
        />
        <button 
          onClick={handleAddVideo} 
          className="add-button"
          disabled={!newVideoUrl.trim()}
        >
          Add Video
        </button>
      </div>

      {videosGrid}

      {deleteIndex !== null && (
        <DeleteModal
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}