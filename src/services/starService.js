import * as driveService from './driveService';
import { withTokenRefresh } from './authService';
import * as storage from '../utils/storage';

const FILES = {
  STAR: 'star.json',
  FAVORITES: 'favorites.json',
  TAGS: 'tags.json',
  YOUTUBE: 'youtube.json'
};

const validateData = (data, type = 'array') => {
  if (type === 'array') {
    return Array.isArray(data) ? data : [];
  }
  return typeof data === 'object' && data !== null ? data : {};
};

export const saveStarFile = async (accessToken) => {
  return withTokenRefresh(async (token) => {
    try {
      // Get raw stars array from localStorage
      const stars = storage.getItem(storage.KEYS.STARS, []);
      
      // Ensure it's a plain array, not a nested object
      const starsArray = Array.isArray(stars) ? stars : 
                        (stars?.stars ? stars.stars : []);

      await saveFile(token, FILES.STAR, starsArray);
      await saveFile(token, FILES.FAVORITES, storage.getItem(storage.KEYS.FAVORITES, {}));
      await saveFile(token, FILES.TAGS, storage.getItem(storage.KEYS.TAGS, []));
      await saveFile(token, FILES.YOUTUBE, storage.getItem(storage.KEYS.YOUTUBE, []));
    } catch (error) {
      console.error('Save error:', error);
      throw error;
    }
  });
};

const saveFile = async (accessToken, fileName, data) => {
  try {
    // Create blob with proper formatting
    const fileContent = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });

    const files = await driveService.listFiles(accessToken);
    const existingFile = files.find(file => file.name === fileName);
    
    if (existingFile) {
      // Update existing file
      const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: fileContent,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to update ${fileName}: ${res.status} ${res.statusText} ${text}`);
      }
      return await res.json().catch(() => null);
    } else {
      // Create new file
      const metadata = {
        name: fileName,
        mimeType: 'application/json',
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', fileContent);

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to create ${fileName}: ${res.status} ${res.statusText} ${text}`);
      }
      return await res.json().catch(() => null);
    }
  } catch (error) {
    console.error(`Error saving ${fileName}:`, error);
    throw error;
  }
};

const fetchFile = async (accessToken, fileName) => {
  try {
    const files = await driveService.listFiles(accessToken);
    const file = files.find(f => f.name === fileName);
    
    if (!file) return null;

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${fileName}:`, error);
    return null;
  }
};

export const fetchStarFile = async (accessToken) => {
  return withTokenRefresh(async (token) => {
    try {
      const [starsData, favoritesData, tagsData, youtubeData] = await Promise.all([
        fetchFile(token, FILES.STAR),
        fetchFile(token, FILES.FAVORITES),
        fetchFile(token, FILES.TAGS),
        fetchFile(token, FILES.YOUTUBE)
      ]);

      // Ensure consistent array format for stars
      const stars = Array.isArray(starsData) ? starsData : 
                   starsData?.stars ? starsData.stars : [];

      // Store normalized data in localStorage
      stars.sort();
      storage.setItem(storage.KEYS.FAVORITES, favoritesData || {});
      storage.setItem(storage.KEYS.TAGS, tagsData || []);
      storage.setItem(storage.KEYS.YOUTUBE, youtubeData || []);

      return stars;
    } catch (error) {
      console.error('Error fetching data:', error);
      return [];
    }
  });
};

export const editStar = async (starId, updatedData) => {
  try {
    const stars = storage.getItem(storage.KEYS.STARS, []);
    const starsArray = Array.isArray(stars) ? stars : (stars?.stars ? stars.stars : []);
    
    const updatedStars = starsArray.map(star => 
      star.id === starId ? { ...star, ...updatedData } : star
    );
    console.log('Updated stars array:', updatedStars);
    storage.setItem(storage.KEYS.STARS, updatedStars);
    return updatedStars;
  } catch (error) {
    console.error('Edit star error:', error);
    throw error;
  }
};

export const syncWithDrive = async (accessToken) => {
  return withTokenRefresh(async (token) => {
    try {
      if (!token) throw new Error('Missing access token');

      // safe parse with defaults
      const starsRaw = storage.getItem(storage.KEYS.STARS, []);
      const favoritesRaw = storage.getItem(storage.KEYS.FAVORITES, {});
      const tagsRaw = storage.getItem(storage.KEYS.TAGS, []);
      const youtubeLinks = storage.getItem(storage.KEYS.YOUTUBE, []);

      // validate data

      const stars = validateData(starsRaw, 'array');
      const favorites = validateData(favoritesRaw, 'object');
      const tags = validateData(tagsRaw, 'array');
      const youtube = validateData(youtubeLinks, 'array');

      // upload in parallel (order doesn't matter)
      await Promise.all([
        saveFile(token, FILES.STAR, stars),
        saveFile(token, FILES.FAVORITES, favorites),
        saveFile(token, FILES.TAGS, tags),
        saveFile(token, FILES.YOUTUBE, youtube)
      ]);
    } catch (error) {
      console.error('Sync error:', error);
      throw error;
    }
  });
};