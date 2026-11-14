import { useEffect, useRef } from 'react';

/**
 * Call `onEscape` when Esc is pressed while the component is mounted, so a
 * dialog can be closed from the keyboard instead of clicking Cancel.
 *
 * Something on top that handles Esc itself (the search panel) stops the key
 * before it gets here, so only the topmost thing closes.
 *
 * @param {() => void} onEscape
 */
export const useEscapeKey = (onEscape) => {
  const latest = useRef(onEscape);
  useEffect(() => {
    latest.current = onEscape;
  });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) latest.current?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
};
