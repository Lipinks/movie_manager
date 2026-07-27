import { useEffect, useState } from 'react';

const ThumbnailPreview = ({ imageUrl, className = '' }) => {
  const [previewError, setPreviewError] = useState(false);
  const thumbnailUrl = (imageUrl || '').trim();

  useEffect(() => {
    setPreviewError(false);
  }, [thumbnailUrl]);

  return (
    <div className={`thumbnail-preview-panel ${className}`.trim()}>
      <div className="thumbnail-preview-title">Thumbnail Preview</div>
      <div className="thumbnail-preview-frame">
        {thumbnailUrl && !previewError ? (
          <img
            src={thumbnailUrl}
            alt="Thumbnail preview"
            className="thumbnail-preview-image"
            onError={() => setPreviewError(true)}
          />
        ) : (
          <div className="thumbnail-preview-placeholder">
            {thumbnailUrl ? 'Unable to load image' : 'Paste Thumbnail URL to preview'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ThumbnailPreview;
