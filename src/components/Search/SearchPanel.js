import { useState, useMemo, useEffect, useRef, useDeferredValue, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { buildIndex, search } from '../../services/searchService';
import { getFaviconUrl } from '../../utils/url';
import { viewerUrl } from '../../utils/driveImage';
import './SearchPanel.css';

/** Results shown per group before "Show all" / "See all". */
const PER_GROUP = 5;
/** Cap for an expanded group, so one huge group can't flood the panel. */
const EXPANDED_LIMIT = 100;

const openInNewTab = (url) => window.open(url, '_blank', 'noopener,noreferrer');

const ResultRow = ({ row }) => {
  const { group, item } = row;
  if (group === 'stars') {
    return (
      <>
        <img className="search-thumb search-thumb--round" src={item.imageUrl} alt="" loading="lazy" />
        <span className="search-row-text">
          <span className="search-row-title">{item.title}</span>
          <span className="search-row-sub">{item.videoCount} video{item.videoCount === 1 ? '' : 's'}</span>
        </span>
      </>
    );
  }
  if (group === 'videos') {
    return (
      <>
        <img className="search-thumb" src={item.imageUrl} alt="" loading="lazy" />
        <span className="search-row-text">
          <span className="search-row-title">{item.title}</span>
          <span className="search-row-sub">{[item.starName, item.tags.join(', ')].filter(Boolean).join(' · ')}</span>
        </span>
      </>
    );
  }
  if (group === 'categories') {
    return (
      <>
        <span className="search-thumb search-thumb--icon" aria-hidden="true">🗂️</span>
        <span className="search-row-text">
          <span className="search-row-title">{item.title}</span>
          <span className="search-row-sub">{item.videoCount} video{item.videoCount === 1 ? '' : 's'}</span>
        </span>
      </>
    );
  }
  if (group === 'updates') {
    return (
      <>
        <img className="search-thumb search-thumb--icon" src={getFaviconUrl(item.url, 32)} alt="" loading="lazy" />
        <span className="search-row-text">
          <span className="search-row-title">{item.title}</span>
          <span className="search-row-sub">{item.hostname}{item.isVPN ? ' · VPN required' : ''}</span>
        </span>
      </>
    );
  }
  return (
    <>
      <img className="search-thumb" src={item.image.thumbnailLink} alt="" loading="lazy" />
      <span className="search-row-text">
        <span className="search-row-title">{item.title}</span>
        <span className="search-row-sub">{item.folderName}</span>
      </span>
    </>
  );
};

/**
 * Search everything, from one box. Opened from the 🔍 header button or with
 * Ctrl/⌘+K or "/". Arrow keys move, Enter opens, Esc closes.
 */
const SearchPanel = ({ onClose }) => {
  const navigate = useNavigate();
  // A fresh snapshot per opening, so recent edits and synced changes show.
  const index = useMemo(() => buildIndex(), []);
  const [query, setQuery] = useState('');
  // Keeps typing responsive even if a keystroke's results take a moment to draw.
  const deferredQuery = useDeferredValue(query);
  const groups = useMemo(() => search(index, deferredQuery), [index, deferredQuery]);

  const [expanded, setExpanded] = useState(() => new Set());
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  /** Every selectable line, in display order: results plus "show all" lines. */
  const rows = useMemo(
    () =>
      groups.flatMap((group) => {
        const limit = expanded.has(group.key) ? EXPANDED_LIMIT : PER_GROUP;
        const lines = group.items.slice(0, limit).map((item) => ({ id: item.id, group: group.key, item }));
        if (group.total > lines.length) {
          lines.push(
            group.key === 'videos'
              ? { id: 'videos-see-all', group: group.key, kind: 'see-all', total: group.total }
              : { id: `${group.key}-show-all`, group: group.key, kind: 'expand', total: group.total }
          );
        }
        return lines;
      }),
    [groups, expanded]
  );

  // A new query starts from the top result.
  useEffect(() => setActive(0), [deferredQuery]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const choose = useCallback(
    (row) => {
      if (!row) return;
      if (row.kind === 'expand') {
        setExpanded((prev) => new Set(prev).add(row.group));
        return;
      }
      if (row.kind === 'see-all') {
        navigate(`/videos?q=${encodeURIComponent(deferredQuery.trim())}`);
      } else if (row.group === 'stars') {
        navigate(`/star/${encodeURIComponent(row.item.starKey)}`);
      } else if (row.group === 'videos' || row.group === 'updates') {
        if (row.item.url) openInNewTab(row.item.url);
      } else if (row.group === 'categories') {
        navigate(`/videos?tag=${encodeURIComponent(row.item.title)}`);
      } else if (row.group === 'gallery') {
        const url = viewerUrl(row.item.image);
        if (url) openInNewTab(url);
        else navigate('/gallery');
      }
      onClose();
    },
    [navigate, deferredQuery, onClose]
  );

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!rows.length) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + step + rows.length) % rows.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(rows[active]);
    } else if (event.key === 'Escape') {
      // Don't also close something underneath, like the Gallery viewer.
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Tab') {
      // The input is the only focusable part; keep focus inside the panel.
      event.preventDefault();
    }
  };

  const activeId = rows[active] ? `search-option-${rows[active].id}` : undefined;
  let rowIndex = -1;

  return createPortal(
    <div
      className="search-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="search-panel" role="dialog" aria-modal="true" aria-label="Search">
        <div className="search-input-row">
          <span className="search-input-icon" aria-hidden="true">🔍</span>
          <input
            className="search-input"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search stars, videos, categories, sites and photos"
            aria-label="Search"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls="search-results"
            aria-activedescendant={activeId}
            autoComplete="off"
            spellCheck="false"
            autoFocus
          />
          <button type="button" className="search-close" onClick={onClose} aria-label="Close search">
            Esc
          </button>
        </div>

        <div className="search-results" id="search-results" role="listbox" aria-label="Results" ref={listRef}>
          {!deferredQuery.trim() && (
            <p className="search-empty">
              Type to search stars, videos, categories and Updates sites. Gallery photos are searched in the
              folders you’ve opened this visit.
            </p>
          )}
          {deferredQuery.trim() && groups.length === 0 && (
            <p className="search-empty">Nothing matches “{deferredQuery.trim()}”.</p>
          )}

          {groups.map((group) => (
            <div className="search-group" key={group.key} role="group" aria-label={group.label}>
              <div className="search-group-label" aria-hidden="true">
                {group.label} <span className="search-group-count">{group.total}</span>
              </div>
              {rows
                .filter((row) => row.group === group.key)
                .map((row) => {
                  rowIndex += 1;
                  const index = rowIndex;
                  const isActive = index === active;
                  return (
                    <div
                      key={row.id}
                      id={`search-option-${row.id}`}
                      role="option"
                      aria-selected={isActive}
                      className={`search-row ${row.kind ? 'search-row--more' : ''} ${isActive ? 'is-active' : ''}`}
                      onMouseMove={() => !isActive && setActive(index)}
                      onClick={() => choose(row)}
                    >
                      {row.kind === 'see-all' && <>See all {row.total.toLocaleString()} videos →</>}
                      {row.kind === 'expand' && <>Show all {row.total.toLocaleString()}</>}
                      {!row.kind && <ResultRow row={row} />}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>

        <div className="search-footer" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SearchPanel;
