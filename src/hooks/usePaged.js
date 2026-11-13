import { useState, useMemo, useCallback } from 'react';

/**
 * Show a long list a page at a time.
 *
 * Rendering thousands of cards at once makes a page slow to open and slow to
 * filter, so callers render `visible` and offer `showMore` (see ShowMore).
 *
 * @param {Array}  items     the full list, already filtered and sorted
 * @param {number} pageSize  how many to show at first, and per "show more"
 * @param {string} resetKey  when this changes (a new filter, say), the list
 *                           starts again from the first page
 * @returns {{visible: Array, remaining: number, showMore: () => void}}
 */
export const usePaged = (items, pageSize, resetKey = '') => {
  // Storing the key beside the count resets the page during render when the
  // key changes, without an extra effect-driven render.
  const [page, setPage] = useState({ key: resetKey, count: pageSize });
  const count = page.key === resetKey ? page.count : pageSize;

  const showMore = useCallback(() => {
    setPage((prev) => ({
      key: resetKey,
      count: (prev.key === resetKey ? prev.count : pageSize) + pageSize,
    }));
  }, [resetKey, pageSize]);

  const visible = useMemo(() => items.slice(0, count), [items, count]);

  return { visible, remaining: Math.max(0, items.length - count), showMore };
};
