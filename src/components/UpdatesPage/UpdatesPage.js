import { useState, useEffect, useCallback } from 'react';
import * as updatesService from '../../services/updatesService';
import { getFaviconUrl } from '../../utils/url';
import './UpdatesPage.css';

/** Above this many links, confirm before spraying tabs across the browser. */
const CONFIRM_THRESHOLD = 5;

const GenericSiteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
  </svg>
);

/**
 * One saved site. The favicon is best-effort: if the icon service cannot
 * resolve one (or the request fails) it falls back to a generic globe.
 */
const SiteCard = ({ site, onRemove }) => {
  const [iconFailed, setIconFailed] = useState(false);
  const faviconUrl = getFaviconUrl(site.url);
  const showIcon = faviconUrl && !iconFailed;

  return (
    <div className="media-card update-card">
      <div className="update-card-icon">
        {showIcon ? (
          <img src={faviconUrl} alt="" width="24" height="24" onError={() => setIconFailed(true)} />
        ) : (
          <GenericSiteIcon />
        )}
      </div>

      <div className="update-card-body">
        <a
          className="update-card-name"
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          title={site.url}
        >
          {site.name}
        </a>
        <span className={`update-vpn-badge ${site.isVPN ? 'required' : 'not-required'}`}>
          {site.isVPN ? 'VPN Required' : 'VPN Not Required'}
        </span>
      </div>

      <button
        type="button"
        className="update-card-remove"
        onClick={() => onRemove(site)}
        title={`Remove ${site.name}`}
        aria-label={`Remove ${site.name}`}
      >
        ×
      </button>
    </div>
  );
};

const UpdatesPage = () => {
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState({ name: '', url: '', isVPN: false });
  const [status, setStatus] = useState(null);

  useEffect(() => {
    setSites(updatesService.getSites());
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (status?.type === 'error') setStatus(null);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    const result = updatesService.addSite(form);

    if (result.error) {
      setStatus({ type: 'error', text: result.error });
      return;
    }

    setSites(result.sites);
    setForm({ name: '', url: '', isVPN: false });
    setStatus(null);
  };

  const handleRemove = useCallback((site) => {
    if (!window.confirm(`Remove "${site.name}" from Updates?`)) return;
    setSites(updatesService.removeSite(site.id));
  }, []);

  /**
   * Open every saved link.
   *
   * `separateTabs` gives each link its own *named* target, so clicking again
   * reuses that same set of tabs instead of piling up a second copy of
   * everything. Without a name, each call spawns brand-new tabs.
   *
   * Browsers only allow a burst of window.open() calls inside a real user
   * gesture, and even then may block some — window.open returns null for
   * those, so the blocked count is reported rather than silently swallowed.
   */
  const openAll = (separateTabs) => {
    if (!sites.length) return;

    if (sites.length > CONFIRM_THRESHOLD) {
      const where = separateTabs ? ' in new tabs' : '';
      if (!window.confirm(`Open ${sites.length} links${where}?`)) return;
    }

    let blocked = 0;
    sites.forEach((site, index) => {
      const target = separateTabs ? `updates-${site.id ?? index}` : '_blank';
      const opened = window.open(site.url, target, 'noopener,noreferrer');
      if (!opened) blocked += 1;
    });

    if (blocked) {
      setStatus({
        type: 'error',
        text: `Opened ${sites.length - blocked} of ${sites.length}. Your browser blocked ${blocked} — allow pop-ups for this site to open them all.`,
      });
    } else {
      setStatus({ type: 'success', text: `Opened ${sites.length} link${sites.length === 1 ? '' : 's'}.` });
    }
  };

  const hasSites = sites.length > 0;

  return (
    <div className="updates-page">
      <h1 className="updates-page-title">Updates</h1>

      <form className="updates-form" onSubmit={handleAdd}>
        <input
          type="text"
          name="name"
          className="updates-input"
          placeholder="Name"
          value={form.name}
          onChange={handleChange}
          aria-label="Website name"
        />
        <input
          type="text"
          name="url"
          className="updates-input"
          placeholder="Website Link (https://example.com)"
          value={form.url}
          onChange={handleChange}
          aria-label="Website link"
        />
        <label className="updates-vpn-toggle">
          <input
            type="checkbox"
            name="isVPN"
            checked={form.isVPN}
            onChange={handleChange}
            aria-label="VPN Required"
          />
          <span>VPN Required</span>
        </label>
        <button type="submit" className="updates-add-btn">Add Website</button>
      </form>

      <div className="updates-actions">
        {/* aria-label mirrors the visible text: a `title` alone would become
            the accessible name and announce the tooltip instead. */}
        <button
          type="button"
          className="updates-open-btn"
          onClick={() => openAll(false)}
          disabled={!hasSites}
          aria-label="Open All Links"
          title={hasSites ? 'Open every saved link' : 'Add a website first'}
        >
          🔗 Open All Links
        </button>
        <button
          type="button"
          className="updates-open-btn secondary"
          onClick={() => openAll(true)}
          disabled={!hasSites}
          aria-label="Open All Links in New Tabs"
          title={hasSites ? 'Open every saved link in its own tab' : 'Add a website first'}
        >
          🗂️ Open All Links in New Tabs
        </button>
        {hasSites && (
          <span className="updates-count">{sites.length} saved</span>
        )}
      </div>

      {status && (
        <p className={status.type === 'error' ? 'modal-error' : 'modal-success'} role="status">
          {status.text}
        </p>
      )}

      {hasSites ? (
        <div className="updates-grid">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} onRemove={handleRemove} />
          ))}
        </div>
      ) : (
        <p className="no-data">No websites saved yet — add your first one above.</p>
      )}
    </div>
  );
};

export default UpdatesPage;
