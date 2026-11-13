import { useSyncExternalStore } from 'react';
import * as autoSyncService from '../../services/autoSyncService';

/** The current auto-sync status; re-renders whenever it changes. */
export const useSyncStatus = () => useSyncExternalStore(autoSyncService.subscribe, autoSyncService.getStatus);

const formatTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * What the account menu shows for each auto-sync state.
 * `action: 'resume'` offers a retry button; `attention` marks states the
 * user should look at, which the menu button highlights.
 * @returns null while auto-sync is off (signed out)
 */
export const describeSyncStatus = ({ state, lastSyncedAt }) => {
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
        detail: "Couldn't reach Google Drive. Your changes are kept in this browser and will retry.",
        action: 'resume',
        actionLabel: 'Retry now',
        attention: true,
      };
    case 'paused':
      return {
        icon: '⏸️',
        label: 'Sync paused',
        detail: 'Your Google session needs renewing before syncing can continue.',
        action: 'resume',
        actionLabel: 'Resume syncing',
        attention: true,
      };
    case 'setup':
      return {
        icon: '❓',
        label: 'Choose a copy',
        detail:
          "This browser's data and the copy on Google Drive are different, so auto-sync hasn't overwritten either. " +
          "Fetch keeps Drive's copy; Sync keeps this browser's copy. Auto-sync starts after that.",
        attention: true,
      };
    default:
      return null;
  }
};
