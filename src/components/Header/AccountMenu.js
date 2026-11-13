import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as autoSyncService from '../../services/autoSyncService';
import { useSyncStatus, describeSyncStatus } from './syncStatus';
import './AccountMenu.css';

/**
 * One header button for everything about Drive and the session: the sync
 * status (its icon shows on the button), Fetch, Sync and Sign out. Clicking
 * it opens a panel over the page; a click outside or Esc closes it.
 */
const AccountMenu = ({ onFetchData, onSync, onSignOut }) => {
  const status = useSyncStatus();
  const info = describeSyncStatus(status);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const close = useCallback((returnFocus) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!panelRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) close(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') close(true);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    panelRef.current?.querySelector('button')?.focus();

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, close]);

  /** Close the panel, then run the chosen action. */
  const choose = (action) => () => {
    close(false);
    action?.();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`header-btn account-btn account-btn--${status.state} ${info?.attention ? 'needs-attention' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? 'account-menu' : undefined}
        aria-label={`Sync and sign out${info ? ` (Drive sync: ${info.label})` : ''}`}
        title={info ? `${info.label}: ${info.detail}` : 'Sync and sign out'}
      >
        <span className="account-btn-icon" aria-hidden="true">{info?.icon || '☁️'}</span>
        <span className="account-btn-caret" aria-hidden="true">▾</span>
      </button>

      {open &&
        createPortal(
          <div ref={panelRef} id="account-menu" className="account-menu" role="group" aria-label="Sync and sign out">
            {info && (
              <div className={`account-menu-status ${info.attention ? 'needs-attention' : ''}`} role="status">
                <span className={`account-menu-status-icon account-btn--${status.state}`} aria-hidden="true">
                  {info.icon}
                </span>
                <div className="account-menu-status-text">
                  <div className="account-menu-status-label">Drive sync: {info.label}</div>
                  <div className="account-menu-status-detail">{info.detail}</div>
                  {info.action === 'resume' && (
                    <button
                      type="button"
                      className="account-menu-retry"
                      onClick={() => autoSyncService.resume().catch(() => {})}
                    >
                      {info.actionLabel}
                    </button>
                  )}
                </div>
              </div>
            )}

            <button type="button" className="account-menu-item" onClick={choose(onFetchData)}>
              <span className="account-menu-item-icon" aria-hidden="true">⬇️</span>
              <span className="account-menu-item-text">
                <span className="account-menu-item-label">Fetch from Drive</span>
                <span className="account-menu-item-hint">Replace this browser’s data with Drive’s copy</span>
              </span>
            </button>
            <button type="button" className="account-menu-item" onClick={choose(onSync)}>
              <span className="account-menu-item-icon" aria-hidden="true">⬆️</span>
              <span className="account-menu-item-text">
                <span className="account-menu-item-label">Sync to Drive</span>
                <span className="account-menu-item-hint">Replace Drive’s copy with this browser’s data</span>
              </span>
            </button>

            <div className="account-menu-divider" />

            <button type="button" className="account-menu-item" onClick={choose(onSignOut)}>
              <span className="account-menu-item-icon" aria-hidden="true">➡️</span>
              <span className="account-menu-item-text">
                <span className="account-menu-item-label">Sign out</span>
              </span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
};

export default AccountMenu;
