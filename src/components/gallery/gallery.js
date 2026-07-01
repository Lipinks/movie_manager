import React, { useState, useEffect, useCallback, useRef } from 'react';
import './gallery.css';

const IMAGES_PER_PAGE = 20;

const Gallery = ({ accessToken }) => {
  const [images, setImages] = useState([]);
  const [subFolders, setSubFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([]); // [{id, name}] breadcrumb
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(IMAGES_PER_PAGE);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(-1);
  const [fullImageUrl, setFullImageUrl] = useState(null);
  const [loadingFullImage, setLoadingFullImage] = useState(false);
  const [error, setError] = useState(null);

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Clean up stale localStorage keys from old implementation
  useEffect(() => {
    localStorage.removeItem('galleryImages');
    localStorage.removeItem('galleryFolderId');
    localStorage.removeItem('galleryHasLoaded');
  }, []);

  // Find or create the 'gallery' folder in Google Drive
  const getGalleryFolderId = useCallback(async () => {
    try {
      // Search for existing 'gallery' folder
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='gallery' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      const searchData = await searchResponse.json();
      
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
      
      // Create 'gallery' folder if it doesn't exist
      const createResponse = await fetch(
        'https://www.googleapis.com/drive/v3/files',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'gallery',
            mimeType: 'application/vnd.google-apps.folder'
          })
        }
      );
      const createData = await createResponse.json();
      return createData.id;
    } catch (err) {
      console.error('Error getting gallery folder:', err);
      throw err;
    }
  }, [accessToken]);

  const fetchFolderContents = useCallback(async (folderId, forceRefresh = false) => {
    const cacheKey = `galleryFolder_${folderId}`;
    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { folders, images: imgs } = JSON.parse(cached);
        setSubFolders(folders || []);
        setImages(imgs || []);
        setVisibleCount(IMAGES_PER_PAGE);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const [foldersRes, imagesRes] = await Promise.all([
        fetch(
          `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)&orderBy=name`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ),
        fetch(
          `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and (mimeType contains 'image/') and trashed=false&fields=files(id,name,mimeType,thumbnailLink,createdTime)&orderBy=createdTime desc&pageSize=1000`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
      ]);

      if (!foldersRes.ok || !imagesRes.ok) throw new Error('Failed to fetch folder contents');

      const [foldersData, imagesData] = await Promise.all([foldersRes.json(), imagesRes.json()]);
      const fetchedFolders = foldersData.files || [];
      const fetchedImages = imagesData.files || [];

      setSubFolders(fetchedFolders);
      setImages(fetchedImages);
      setVisibleCount(IMAGES_PER_PAGE);
      sessionStorage.setItem(cacheKey, JSON.stringify({ folders: fetchedFolders, images: fetchedImages }));
    } catch (err) {
      console.error('Error fetching folder contents:', err);
      setError('Failed to load contents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Initialize: find gallery root folder then load its contents
  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        let rootId = sessionStorage.getItem('galleryFolderId');
        if (!rootId) {
          rootId = await getGalleryFolderId();
          sessionStorage.setItem('galleryFolderId', rootId);
        }
        setCurrentFolderId(rootId);
        setFolderPath([{ id: rootId, name: 'Gallery' }]);
        await fetchFolderContents(rootId);
      } catch (err) {
        setError('Failed to initialize gallery.');
        setLoading(false);
      }
    })();
  }, [accessToken, getGalleryFolderId, fetchFolderContents]);

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    const nonImages = files.filter(f => !f.type.startsWith('image/'));
    if (nonImages.length) {
      alert(`${nonImages.length} file(s) skipped — not an image.`);
    }
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) return;

    setUploading(true);
    const folderId = currentFolderId;
    const uploaded = [];
    const failed = [];

    for (const file of imageFiles) {
      try {
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify({ name: file.name, parents: [folderId] })], { type: 'application/json' }));
        formData.append('file', file);

        const response = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,thumbnailLink,createdTime',
          { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: formData }
        );

        if (!response.ok) throw new Error('Upload failed');
        uploaded.push(await response.json());
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
        failed.push(file.name);
      }
    }

    if (uploaded.length) {
      setImages(prev => {
        const updated = [...uploaded, ...prev];
        const cacheKey = `galleryFolder_${folderId}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { folders } = JSON.parse(cached);
          sessionStorage.setItem(cacheKey, JSON.stringify({ folders, images: updated }));
        }
        return updated;
      });
    }

    if (failed.length) {
      alert(`Failed to upload: ${failed.join(', ')}`);
    } else {
      alert(`${uploaded.length} image${uploaded.length !== 1 ? 's' : ''} uploaded successfully!`);
    }

    setUploading(false);
    event.target.value = '';
  };

  const handleDelete = async (imageId, imageName) => {
    if (!window.confirm(`Are you sure you want to delete "${imageName}"?`)) return;

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${imageId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok && response.status !== 204) throw new Error('Delete failed');

      setImages(prev => {
        const updated = prev.filter(img => img.id !== imageId);
        if (currentFolderId) {
          const cacheKey = `galleryFolder_${currentFolderId}`;
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const { folders } = JSON.parse(cached);
            sessionStorage.setItem(cacheKey, JSON.stringify({ folders, images: updated }));
          }
        }
        return updated;
      });
      setSelectedImage(null);
      setCurrentImageIndex(-1);
    } catch (err) {
      console.error('Error deleting image:', err);
      alert('Failed to delete image. Please try again.');
    }
  };

  // Use thumbnailLink at its original =s220 size — Google caches this aggressively.
  // Requesting larger sizes (=s400) for 20+ images simultaneously triggers 429 Too Many Requests.
  const getImageUrl = (image) => {
    if (image.thumbnailLink) {
      return image.thumbnailLink; // original =s220, no upscaling
    }
    return `https://www.googleapis.com/drive/v3/files/${image.id}?alt=media&access_token=${accessToken}`;
  };

  // Fetch full-size image using Bearer token → blob URL (reliable, no cookie needed)
  const fetchFullImage = async (image, index) => {
    setLoadingFullImage(true);
    setSelectedImage(image);
    setCurrentImageIndex(index);
    setFullImageUrl(null);

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${image.id}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.ok) throw new Error('Failed to load image');
      const blob = await response.blob();
      setFullImageUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error('Error loading full image:', err);
      setFullImageUrl(`https://www.googleapis.com/drive/v3/files/${image.id}?alt=media&access_token=${accessToken}`);
    } finally {
      setLoadingFullImage(false);
    }
  };

  const closeModal = () => {
    if (fullImageUrl && fullImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(fullImageUrl);
    }
    setSelectedImage(null);
    setFullImageUrl(null);
    setCurrentImageIndex(-1);
  };

  const navigateToFolder = (folder) => {
    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
    fetchFolderContents(folder.id);
  };

  const navigateBreadcrumb = (index) => {
    setFolderPath(prev => {
      const newPath = prev.slice(0, index + 1);
      const target = newPath[index];
      setCurrentFolderId(target.id);
      const cached = sessionStorage.getItem(`galleryFolder_${target.id}`);
      if (cached) {
        const { folders, images: imgs } = JSON.parse(cached);
        setSubFolders(folders || []);
        setImages(imgs || []);
        setVisibleCount(IMAGES_PER_PAGE);
      } else {
        fetchFolderContents(target.id);
      }
      return newPath;
    });
  };

  const currentImages = images.slice(0, visibleCount);
  const hasMoreImages = visibleCount < images.length;

  const loadMore = () => {
    setVisibleCount(prev => Math.min(prev + IMAGES_PER_PAGE, images.length));
  };

  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      const prevIndex = currentImageIndex - 1;
      if (fullImageUrl && fullImageUrl.startsWith('blob:')) URL.revokeObjectURL(fullImageUrl);
      fetchFullImage(currentImages[prevIndex], prevIndex);
    }
  };

  const goToNextImage = () => {
    if (currentImageIndex < currentImages.length - 1) {
      const nextIndex = currentImageIndex + 1;
      if (fullImageUrl && fullImageUrl.startsWith('blob:')) URL.revokeObjectURL(fullImageUrl);
      fetchFullImage(currentImages[nextIndex], nextIndex);
    }
  };

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchMove = (e) => { touchEndX.current = e.touches[0].clientX; };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      diff > 0 ? goToNextImage() : goToPreviousImage();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedImage) return;
      if (e.key === 'ArrowLeft') goToPreviousImage();
      else if (e.key === 'ArrowRight') goToNextImage();
      else if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, currentImageIndex, currentImages]);

  if (loading) {
    return (
      <div className="gallery-page">
        <div className="gallery-loading">
          <div className="loading-spinner"></div>
          <p>Loading gallery...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-page">
      <div className="gallery-header">
        <div className="gallery-actions">
          <label className={`upload-btn ${uploading ? 'uploading' : ''}`}>
            {uploading ? (
              <><span className="upload-spinner"></span>Uploading...</>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M12 4L12 16M12 4L8 8M12 4L16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
                </svg>
                Upload Image
              </>
            )}
            <input type="file" accept="image/*" multiple onChange={handleUpload} disabled={uploading} hidden />
          </label>
          <button className="refresh-btn" onClick={() => fetchFolderContents(currentFolderId, true)} disabled={loading}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="gallery-error">
          <p>{error}</p>
          <button onClick={() => fetchFolderContents(currentFolderId, true)}>Try Again</button>
        </div>
      )}

      {!error && (
        <>
          {/* Breadcrumb - shown when inside a subfolder */}
          {folderPath.length > 1 && (
            <div className="gallery-breadcrumb">
              {folderPath.map((crumb, index) => (
                <React.Fragment key={crumb.id}>
                  {index > 0 && <span className="breadcrumb-separator">›</span>}
                  {index < folderPath.length - 1 ? (
                    <button className="breadcrumb-item" onClick={() => navigateBreadcrumb(index)}>
                      {crumb.name}
                    </button>
                  ) : (
                    <span className="breadcrumb-item breadcrumb-current">{crumb.name}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Subfolder cards */}
          {subFolders.length > 0 && (
            <div className="gallery-folders">
              {subFolders.map(folder => (
                <div key={folder.id} className="folder-item" onClick={() => navigateToFolder(folder)}>
                  <div className="folder-icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="44" height="44">
                      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                    </svg>
                  </div>
                  <span className="folder-name">{folder.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Images grid */}
          {currentImages.length > 0 && (
            <div className="gallery-grid">
              {currentImages.map((image, index) => (
                <div
                  key={image.id}
                  className="gallery-item"
                  onClick={() => fetchFullImage(image, index)}
                >
                  <img
                    src={getImageUrl(image)}
                    alt={image.name}
                    loading="lazy"
                    onError={(e) => {
                      if (!e.target.dataset.errored) {
                        e.target.dataset.errored = 'true';
                        e.target.src = `https://www.googleapis.com/drive/v3/files/${image.id}?alt=media&access_token=${accessToken}`;
                      } else {
                        e.target.style.display = 'none';
                      }
                    }}
                  />
                  <div className="gallery-item-overlay">
                    <span className="gallery-item-name">{image.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {images.length === 0 && subFolders.length === 0 && (
            <div className="gallery-empty">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="64" height="64">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              {folderPath.length > 1 ? (
                <p>This folder is empty</p>
              ) : (
                <>
                  <p>No images in gallery yet</p>
                  <p className="gallery-empty-hint">Upload your first image to get started!</p>
                </>
              )}
            </div>
          )}

          {hasMoreImages && (
            <div className="gallery-load-more">
              <button className="load-more-btn" onClick={loadMore}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Load More ({images.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {selectedImage && (
        <div
          className="gallery-modal"
          onClick={closeModal}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="gallery-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>×</button>

            {currentImageIndex > 0 && (
              <button className="modal-nav modal-nav-prev" onClick={(e) => { e.stopPropagation(); goToPreviousImage(); }}>
                ‹
              </button>
            )}
            {currentImageIndex < currentImages.length - 1 && (
              <button className="modal-nav modal-nav-next" onClick={(e) => { e.stopPropagation(); goToNextImage(); }}>
                ›
              </button>
            )}

            {loadingFullImage ? (
              <div className="modal-loading">
                <div className="loading-spinner"></div>
                <p>Loading image...</p>
              </div>
            ) : (
              <img src={fullImageUrl} alt={selectedImage.name} />
            )}

            <div className="modal-info">
              <span className="modal-name">{selectedImage.name}</span>
              <span className="modal-counter">{currentImageIndex + 1} / {currentImages.length}</span>
              <button
                className="modal-delete-btn"
                onClick={() => handleDelete(selectedImage.id, selectedImage.name)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
