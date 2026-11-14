import { useState, useEffect, useRef, useCallback, useContext, useSyncExternalStore, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AccountMenu from './AccountMenu';
import Icon from '../common/Icon';
import { HeaderSlotContext } from './headerSlot';
import * as themeService from '../../services/themeService';
import './Header.css';

// Loaded the first time search opens, so pages that never search don't pay for it.
const loadSearchPanel = () => import('../Search/SearchPanel');
const SearchPanel = lazy(loadSearchPanel);

/** True when a key press is going into a text field, where "/" is just a character. */
const isTyping = (target) => Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));

/** Page navigation. `match` decides which entry is highlighted for the current URL. */
const NAV = [
  { path: '/', label: 'Home', icon: 'home', match: (p) => p === '/' || p.startsWith('/star/') },
  { path: '/videos', label: 'Videos', icon: 'film', match: (p) => p.startsWith('/videos') },
  { path: '/category', label: 'Categories', icon: 'tag', match: (p) => p.startsWith('/category') },
  { path: '/youtube', label: 'YouTube', icon: 'youtube', match: (p) => p.startsWith('/youtube') },
  { path: '/gallery', label: 'Gallery', icon: 'image', match: (p) => p.startsWith('/gallery') },
  { path: '/updates', label: 'Updates', icon: 'bell', match: (p) => p.startsWith('/updates') },
];

const Header = ({ onSignOut, onSync, onFetchData }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const slotContext = useContext(HeaderSlotContext);
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

      <nav className="header-nav" aria-label="Main">
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <button
              key={item.path}
              type="button"
              className={`header-btn ${active ? 'is-active' : ''}`}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              data-tooltip={item.label}
            >
              <Icon name={item.icon} />
            </button>
          );
        })}
      </nav>

      <div className="header-end">
        {/* Filled by the current page (the Home page's star controls). */}
        <div className="header-page-actions" ref={slotContext?.setSlot} />

        <div className="header-actions">
          <button
            ref={searchButtonRef}
            type="button"
            className="header-btn"
            onClick={() => setSearchOpen(true)}
            // Start fetching the panel's code as soon as a click looks likely.
            onMouseEnter={loadSearchPanel}
            onFocus={loadSearchPanel}
            aria-label="Search"
            aria-haspopup="dialog"
            data-tooltip="Search (Ctrl+K)"
          >
            <Icon name="search" />
          </button>
          {/* A toggle: pressed means dark mode is on. The icon shows what a click switches to. */}
          <button
            type="button"
            onClick={themeService.toggleTheme}
            className="header-btn"
            aria-pressed={isDark}
            aria-label="Dark mode"
            data-tooltip={isDark ? 'Light mode' : 'Dark mode'}
          >
            <Icon name={isDark ? 'sun' : 'moon'} />
          </button>
          <AccountMenu onFetchData={onFetchData} onSync={onSync} onSignOut={onSignOut} />
        </div>
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
