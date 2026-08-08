import { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import * as authService from './services/authService';
import * as driveSyncService from './services/driveSyncService';
import * as starsService from './services/starsService';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoginPage from './components/LoginPage/LoginPage';
import LoadingPage from './components/LoadingPage/LoadingPage';
import Header from './components/Header/Header';
import StarManager from './components/StarManager/StarManager';
import StarDetails from './components/StarDetails/StarDetails';
import VideosPage from './components/VideosPage/VideosPage';
import CategoryPage from './components/CategoryPage/CategoryPage';
import YoutubePage from './components/youtube/youtube';
import Gallery from './components/gallery/gallery';
import './App.css';

const GOOGLE_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID ||
  '567189276629-9tkesauoqldd41mnr5gdeh0t2ii67432.apps.googleusercontent.com';

// The GIS script itself is loaded once by index.html; this only records which
// OAuth client the token requests should use.
authService.configure(GOOGLE_CLIENT_ID);

/** Turn any thrown value into something worth showing a user. */
const describeError = (error, fallback) => {
  if (error?.name === 'AuthError') {
    return error.interactionRequired
      ? 'Your Google session has expired. Please sign in again.'
      : error.message;
  }
  return error?.message ? `${fallback}: ${error.message}` : fallback;
};

// Component to scroll to top on route change
const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
};

const BigAndBingApp = () => {
  const [accessToken, setAccessToken] = useState(() => authService.getAccessToken());
  const [showAddStar, setShowAddStar] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stars, setStars] = useState(() => starsService.getStars());

  // The auth service owns the session; mirror it into React state so an
  // expired token that cannot be renewed silently drops us back to the login
  // screen instead of leaving a dead app on screen.
  useEffect(() => authService.subscribe(setAccessToken), []);

  const handleSignIn = useCallback(async () => {
    try {
      await authService.signIn();
    } catch (error) {
      // A user who simply closes the Google popup does not need an alert.
      if (error?.code !== 'popup_closed') {
        alert(describeError(error, 'Sign-in failed'));
      }
    }
  }, []);

  const handleSignOut = useCallback(() => {
    authService.signOut();
  }, []);

  const handleStarsUpdate = useCallback((newStars) => {
    if (!Array.isArray(newStars)) return;
    setStars(starsService.saveStars(newStars));
  }, []);

  const handleFetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedStars = await driveSyncService.fetchFromDrive();
      setStars(starsService.saveStars(fetchedStars));
    } catch (error) {
      console.error('Error fetching data from Drive:', error);
      alert(describeError(error, 'Failed to fetch data from Drive'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSync = useCallback(async () => {
    const isConfirmed = window.confirm(
      'Are you sure you want to sync current data to Drive? This will overwrite the existing data on Drive.'
    );
    if (!isConfirmed) return;

    setIsLoading(true);
    try {
      await driveSyncService.syncToDrive();
    } catch (error) {
      console.error('Error syncing to Drive:', error);
      alert(describeError(error, 'Failed to sync with Drive'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (!accessToken) {
    return <LoginPage handleAuth={handleSignIn} />;
  }

  return (
    <HashRouter>
      <ScrollToTop />
      <div>
        <Header
          onAddStar={() => setShowAddStar(true)}
          onSignOut={handleSignOut}
          onSync={handleSync}
          onFetchData={handleFetchData}
        />
        <ErrorBoundary>
          {isLoading ? (
            <LoadingPage />
          ) : (
            <Routes>
              <Route
                path="/"
                element={
                  <StarManager
                    showAddStarModal={showAddStar}
                    closeAddStarModal={() => setShowAddStar(false)}
                    updateStarDetails={handleStarsUpdate}
                    stars={stars}
                  />
                }
              />
              <Route
                path="/star/:starName"
                element={<StarDetails stars={stars} onStarsUpdate={handleStarsUpdate} />}
              />
              <Route path="/videos" element={<VideosPage starName="" />} />
              <Route path="/category" element={<CategoryPage />} />
              <Route path="/youtube" element={<YoutubePage />} />
              <Route path="/gallery" element={<Gallery accessToken={accessToken} />} />
            </Routes>
          )}
        </ErrorBoundary>
      </div>
    </HashRouter>
  );
};

export default BigAndBingApp;
