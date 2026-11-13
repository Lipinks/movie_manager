import { useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import SyncStatus from './SyncStatus';
import * as themeService from '../../services/themeService';
import './Header.css';

const Header = ({ onAddStar, onSignOut, onSync, onFetchData }) => {
  const navigate = useNavigate();
  const isDark = useSyncExternalStore(themeService.subscribe, themeService.getTheme) === themeService.THEMES.DARK;

  return (
    <header className="header">
      <div className="logo">BigAndBig</div>
      <div className="header-buttons">
        <button onClick={() => navigate('/')} className="header-btn home-btn"></button>
        <button onClick={() => navigate('/videos')} className="header-btn videos-btn">Videos</button>
        <button onClick={() => navigate('/category')} className="header-btn category-btn">Category</button>
        <button onClick={() => navigate('/youtube')} className="header-btn insta-btn">Youtube</button>
        <button onClick={() => navigate('/gallery')} className="header-btn insta-btn">Gallery</button>
        <button onClick={() => navigate('/updates')} className="header-btn updates-btn">Updates</button>
        <button onClick={onAddStar} className="header-btn add-star-btn">Add Star</button>
        <SyncStatus />
        <button onClick={onFetchData} className="header-btn fetch-btn"></button>
        <button onClick={onSync} className="header-btn sync-btn"></button>
        {/* A toggle: pressed means dark mode is on. The icon shows what a click switches to. */}
        <button
          type="button"
          onClick={themeService.toggleTheme}
          className="header-btn theme-btn"
          aria-pressed={isDark}
          aria-label="Dark mode"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
        </button>
        <button onClick={onSignOut} className="header-btn signout-btn"></button>
      </div>
    </header>
  );
};

export default Header;
