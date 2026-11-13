import { useEffect } from 'react';
import { onRemoteChange } from '../services/autoSyncService';

/**
 * Re-read a page's data whenever auto-sync brings in changes from Drive (for
 * example, edits made on another device).
 *
 * The page stays mounted, so open dialogs and half-typed forms are kept;
 * only the data the page shows is refreshed.
 *
 * @param {() => void} reload  must be stable (wrap it in useCallback)
 */
export const useRemoteRefresh = (reload) => {
  useEffect(() => onRemoteChange(() => reload()), [reload]);
};
