import { useSyncExternalStore } from 'react';
import * as autoSyncService from '../../services/autoSyncService';

const formatTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** What the indicator shows for each auto-sync state, and what a click does. */
const describe = ({ state, lastSyncedAt }) => {
  switch (state) {
    case 'saved':
      return {
        icon: '✅',
        label: 'Synced',
        detail: lastSyncedAt
          ? `Everything is saved to Google Drive (last synced ${formatTime(lastSyncedAt)}).`
          : 'Everything is saved to Google Drive.',
      };
    case 'pending':
      return { icon: '⏳', label: 'Pending', detail: 'Your changes will upload to Google Drive in a moment.' };
    case 'syncing':
      return { icon: '🔄', label: 'Syncing', detail: 'Syncing with Google Drive…' };
    case 'error':
      return {
        icon: '⚠️',
        label: 'Sync failed',
        detail: "Couldn't reach Google Drive. Your changes are kept in this browser and will retry. Click to retry now.",
        action: 'resume',
      };
    case 'paused':
      return {
        icon: '⏸️',
        label: 'Sync paused',
        detail: 'Your Google session needs renewing. Click to resume syncing.',
        action: 'resume',
      };
    case 'setup':
      return {
        icon: '❓',
        label: 'Choose copy',
        detail:
          "This browser's data and the copy on Google Drive are different, so auto-sync hasn't overwritten either. " +
          "Press ⬇️ Fetch to keep Drive's copy, or ⬆️ Sync to keep this browser's copy. Auto-sync starts after that.",
        action: 'explain',
      };
    default:
      return null;
  }
};

/** Small header indicator showing whether local data is saved to Drive. */
const SyncStatus = () => {
  const status = useSyncExternalStore(autoSyncService.subscribe, autoSyncService.getStatus);
  const info = describe(status);
  if (!info) return null;

  const handleClick = () => {
    if (info.action === 'resume') {
      // Failures are reported through the indicator itself.
      autoSyncService.resume().catch(() => {});
    } else if (info.action === 'explain') {
      window.alert(info.detail);
    }
  };

  return (
    <button
      type="button"
      className={`sync-status sync-status--${status.state}`}
      onClick={handleClick}
      aria-disabled={!info.action}
      title={info.detail}
      aria-label={`Drive sync: ${info.label}. ${info.detail}`}
    >
      <span className="sync-status-icon" aria-hidden="true">{info.icon}</span>
      <span className="sync-status-label">{info.label}</span>
    </button>
  );
};

export default SyncStatus;
