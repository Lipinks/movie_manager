import { useState, useMemo, useCallback } from 'react';
import * as favoritesService from '../../services/favoritesService';
import * as tagService from '../../services/tagService';
import './CategoryDialog.css';

/**
 * Category management: un-tag videos, tag more videos, or delete the category
 * outright.
 *
 * Everything here changes only the *relationship* between a video and this
 * category — the tag operations live in favoritesService and never touch a
 * video's other fields, and no code path deletes a video.
 */

const videoKey = (video) => `${video.starName}::${video.id}`;

/** Thumbnail tile built from the shared media-card primitives. */
const VideoThumb = ({ video, children, className = '' }) => {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`media-card category-video-card ${className}`.trim()}>
      <div className="media-card-image">
        {video.imageUrl && !failed ? (
          <img src={video.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <div className="media-card-fallback" aria-hidden="true">
            {(video.name || '?').charAt(0)}
          </div>
        )}
      </div>
      <div className="category-video-name" title={video.name}>{video.name}</div>
      {children}
    </div>
  );
};

const CategoryDialog = ({ categoryName, onClose, onChanged, onDeleted }) => {
  const [videos, setVideos] = useState(() => favoritesService.listAll());
  const [mode, setMode] = useState('manage');
  const [selected, setSelected] = useState(() => new Set());
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const assigned = useMemo(
    () => videos.filter((video) => (video.tags || []).includes(categoryName)),
    [videos, categoryName]
  );
  const available = useMemo(
    () => videos.filter((video) => !(video.tags || []).includes(categoryName)),
    [videos, categoryName]
  );

  /**
   * Run a persistence action, refresh from the store, and surface the outcome.
   * @returns {boolean} whether it succeeded
   */
  const commit = useCallback(
    (action, successText) => {
      setBusy(true);
      try {
        action();
        setVideos(favoritesService.listAll());
        setStatus({ type: 'success', text: successText });
        onChanged?.();
        return true;
      } catch (error) {
        console.error('[CategoryDialog] Action failed:', error);
        setStatus({
          type: 'error',
          text: error?.message ? `Could not save the change: ${error.message}` : 'Could not save the change.',
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onChanged]
  );

  const handleRemoveVideo = (video) => {
    commit(
      () => favoritesService.removeTagFromVideo(video.starName, video.id, categoryName),
      `Removed "${video.name}" from ${categoryName}. The video itself was kept.`
    );
  };

  const handleSaveSelection = () => {
    const picked = available.filter((video) => selected.has(videoKey(video)));
    if (!picked.length) return;

    const ok = commit(
      () => favoritesService.addTagToVideos(picked, categoryName),
      `Added ${picked.length} video${picked.length === 1 ? '' : 's'} to ${categoryName}.`
    );

    if (ok) {
      setSelected(new Set());
      setMode('manage');
    }
  };

  const handleDeleteCategory = () => {
    const count = assigned.length;
    const impact = count
      ? `It will be removed from ${count} video${count === 1 ? '' : 's'}.`
      : 'No videos are using it.';

    if (!window.confirm(`Delete the category "${categoryName}"?\n\n${impact}\nThe videos themselves will not be deleted.`)) {
      return;
    }

    if (commit(() => tagService.deleteTag(categoryName), '')) {
      onDeleted?.(categoryName);
    }
  };

  const toggleSelected = (video) => {
    const key = videoKey(video);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const cancelSelection = () => {
    setSelected(new Set());
    setMode('manage');
    setStatus(null);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog modal-dialog--gold category-dialog">
        <div className="category-dialog-header">
          <h2 className="modal-title">Edit Category: {categoryName}</h2>
          <button type="button" className="category-dialog-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {status && (
          <p className={status.type === 'error' ? 'modal-error' : 'modal-success'} role="status">
            {status.text}
          </p>
        )}

        {mode === 'manage' ? (
          <>
            <h3 className="category-dialog-section">Videos in this category ({assigned.length})</h3>

            {assigned.length === 0 ? (
              <p className="category-dialog-empty">
                No videos are tagged with this category yet.
              </p>
            ) : (
              <div className="card-grid card-grid--compact">
                {assigned.map((video) => (
                  <VideoThumb key={videoKey(video)} video={video}>
                    <div className="card-actions">
                      <button
                        type="button"
                        className="action-btn delete-btn"
                        onClick={() => handleRemoveVideo(video)}
                        disabled={busy}
                        title={`Remove from ${categoryName}`}
                        aria-label={`Remove ${video.name} from ${categoryName}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <polyline points="3,6 5,6 21,6"></polyline>
                          <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </VideoThumb>
                ))}
              </div>
            )}

            <button
              type="button"
              className="category-dialog-add-btn"
              onClick={() => {
                setStatus(null);
                setMode('add');
              }}
            >
              + Add Videos into this Category
            </button>

            <div className="category-dialog-danger">
              <button
                type="button"
                className="category-dialog-delete-btn"
                onClick={handleDeleteCategory}
                disabled={busy}
              >
                Delete Category
              </button>
              <p className="category-dialog-hint">
                Removes this category from every video. No video is deleted.
              </p>
            </div>
          </>
        ) : (
          <>
            <h3 className="category-dialog-section">
              Select videos to add ({selected.size} selected)
            </h3>

            {available.length === 0 ? (
              <p className="category-dialog-empty">
                Every video is already in this category.
              </p>
            ) : (
              <div className="card-grid card-grid--compact">
                {available.map((video) => {
                  const isSelected = selected.has(videoKey(video));
                  return (
                    <label
                      key={videoKey(video)}
                      className={`category-pick ${isSelected ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="category-pick-checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(video)}
                      />
                      <VideoThumb video={video} />
                    </label>
                  );
                })}
              </div>
            )}

            <div className="modal-buttons">
              <button
                type="button"
                className="save-btn"
                onClick={handleSaveSelection}
                disabled={busy || selected.size === 0}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="cancel-btn" onClick={cancelSelection}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CategoryDialog;
