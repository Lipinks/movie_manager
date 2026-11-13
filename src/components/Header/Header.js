import { useState, useEffect, useRef, useCallback, useSyncExternalStore, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountMenu from './AccountMenu';
import * as themeService from '../../services/themeService';
import './Header.css';

// Loaded the first time search opens, so pages that never search don't pay for it.
const loadSearchPanel = () => import('../Search/SearchPanel');
const SearchPanel = lazy(loadSearchPanel);

/** True when a key press is going into a text field, where "/" is just a character. */
const isTyping = (target) => Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));

const Header = ({ onSignOut, onSync, onFetchData }) => {
  const navigate = useNavigate();
  const isDark = useSyncExternalStore(themeService.subscribe, themeService.getTheme) === themeService.THEMES.DARK;
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButtonRef = useRef(null);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    searchButtonRef.current?.focus();
  }, []);

  // Ctrl/⌘+K anywhere, or "/" when not typing, opens search.
  useEffect(() => {
    const handleKeyDown = (event) => {
      const commandK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isTyping(event.target);
      if (commandK || slash) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="header">
      <div className="logo">BigAndBig</div>

      <nav className="header-buttons" aria-label="Main">
        <button onClick={() => navigate('/')} className="header-btn home-btn" aria-label="Home"></button>
        <button onClick={() => navigate('/videos')} className="header-btn videos-btn">Videos</button>
        <button onClick={() => navigate('/category')} className="header-btn category-btn">Category</button>
        <button onClick={() => navigate('/youtube')} className="header-btn insta-btn">Youtube</button>
        <button onClick={() => navigate('/gallery')} className="header-btn insta-btn">Gallery</button>
        <button onClick={() => navigate('/updates')} className="header-btn updates-btn">Updates</button>
      </nav>

      <div className="header-actions">
        <button
          ref={searchButtonRef}
          type="button"
          className="header-btn search-btn"
          onClick={() => setSearchOpen(true)}
          // Start fetching the panel's code as soon as a click looks likely.
          onMouseEnter={loadSearchPanel}
          onFocus={loadSearchPanel}
          aria-label="Search"
          aria-haspopup="dialog"
          title="Search (Ctrl+K or /)"
        >
          <span aria-hidden="true">🔍</span>
        </button>
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
        <AccountMenu onFetchData={onFetchData} onSync={onSync} onSignOut={onSignOut} />
      </div>

      {searchOpen && (
        <Suspense fallback={null}>
          <SearchPanel onClose={closeSearch} />
        </Suspense>
      )}
    </header>
  );
};

export default Header;
