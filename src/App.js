import { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import * as starService from './services/starService';
import * as storage from './utils/storage';
import LoginPage from './components/LoginPage/LoginPage';
import LoadingPage from './components/LoadingPage/LoadingPage';
import Header from './components/Header/Header';
import StarManager from './components/StarManager/StarManager';
import StarDetails from './components/StarDetails/StarDetails';
import VideosPage from './components/VideosPage/VideosPage';
import YoutubePage from './components/youtube/youtube';
import Gallery from './components/gallery/gallery';
import './App.css';

// Component to scroll to top on route change
const ScrollToTop = () => {
  const location = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  
  return null;
};

const BigAndBingApp = () => {
  const [accessToken, setAccessToken] = useState(storage.getRaw(storage.KEYS.ACCESS_TOKEN));
  const [tokenClient, setTokenClient] = useState(null);
  const [showAddStar, setShowAddStar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stars, setStars] = useState(() => storage.getItem(storage.KEYS.STARS, []));

  const initTokenClient = useCallback(() => {
    if (window.google && window.google.accounts) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID
          || "567189276629-9tkesauoqldd41mnr5gdeh0t2ii67432.apps.googleusercontent.com",
        scope: "https://www.googleapis.com/auth/drive",
        callback: handleAuthResponse,
      });
      setTokenClient(client);
    }
  }, []);

  const handleAuthResponse = (response) => {
    if (response.error) {
      console.error("Token error:", response);
      return;
    }
    setAccessToken(response.access_token);
    storage.setRaw(storage.KEYS.ACCESS_TOKEN, response.access_token);
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initTokenClient;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [initTokenClient]);

  const handleDriveAuth = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: "consent" });
    }
  };

  var handleFetchData = async () => {
    setIsLoading(true);
    try {
      console.log('Going to fetch star data from Drive...');
      var starData = await starService.fetchStarFile(accessToken);
      
      // Sort the fetched data directly, don't use the old stars state
      var sortedStars = [...starData].sort((a, b) => 
        a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' })
      );
      
      setStars(sortedStars);
      storage.setItem(storage.KEYS.STARS, sortedStars);
    } catch (error) {
      console.error('Error fetching stars - handleFetchData:', error);
      alert('Failed to fetch data from Drive');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStarsUpdate = (newStars) => {
    if (Array.isArray(newStars)) {
      console.log('Updating stars as received from child component...');
      setStars(newStars);
      console.log('Stars updated in state and localStorage.');
      storage.setItem(storage.KEYS.STARS, newStars);
    }
  };

  const handleSync = async () => {
    console.log('Starting sync to Drive...');
    var isConfirmed = window.confirm(`Are you sure you want to sync current data to Drive? This will overwrite the existing data on Drive.`);
    if (!isConfirmed) {
      return;
    }
    setIsLoading(true);
    try{
      await starService.saveStarFile(accessToken);
    }catch(error){
      console.error('Sync error:', error);
      alert('Failed to sync with Drive');
    }finally {
      setIsLoading(false);
    }
  };

  const signOut = () => {
    if (window.google && window.google.accounts) {
      window.google.accounts.id.disableAutoSelect();
    }
    setAccessToken(null);
    storage.removeItem(storage.KEYS.ACCESS_TOKEN);
  };

  if (!accessToken) {
    return <LoginPage handleAuth={handleDriveAuth} />;
  }

  return (
    <HashRouter>
      <ScrollToTop />
      <div>
        <Header 
          onAddStar={() => {
            console.log('onAddStar called');
            setShowAddStar(true);
          }}
          onSignOut={signOut}
          onSync={handleSync}
          onFetchData={handleFetchData}
        />
        {isLoading ? (
          <LoadingPage />
        ) : (
          <Routes>
            <Route path="/" element={
              <StarManager 
                showAddStarModal={showAddStar}
                closeAddStarModal={() => setShowAddStar(false)}
                updateStarDetails={handleStarsUpdate}
                stars={stars}
              />
            } />
            <Route path="/star/:starName" element={
              <StarDetails 
                stars={stars} 
                onStarsUpdate={(newStars) => {
                  handleStarsUpdate(newStars);
                }}
              />
            } />
            <Route path="/videos" element={<VideosPage starName={''} />} />
            <Route path="/youtube" element={<YoutubePage/>} />
            <Route path="/gallery" element={<Gallery accessToken={accessToken} />} />
          </Routes>
        )}
      </div>
    </HashRouter>
  );
};

export default BigAndBingApp;