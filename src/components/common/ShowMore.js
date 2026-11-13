import { useEffect, useRef } from 'react';
import './ShowMore.css';

/** Start loading the next page while it is still this far below the screen. */
const PRELOAD_MARGIN = '800px 0px';

/**
 * "Show more" for a paged list (see usePaged). The next page loads by itself
 * as the user scrolls near the end, and the button remains for keyboards,
 * screen readers and browsers without IntersectionObserver.
 *
 * @param {number}   remaining   items not shown yet; renders nothing at 0
 * @param {Function} onShowMore  reveals the next page
 */
const ShowMore = ({ remaining, onShowMore }) => {
  const ref = useRef(null);

  // Re-created after each page so that, if the end of the list is still near
  // the screen once the new page renders, the next one loads too.
  useEffect(() => {
    const target = ref.current;
    if (!remaining || !target || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onShowMore();
      },
      { rootMargin: PRELOAD_MARGIN }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [remaining, onShowMore]);

  if (!remaining) return null;

  return (
    <div className="show-more" ref={ref}>
      <button type="button" className="show-more-btn" onClick={onShowMore}>
        Show more ({remaining.toLocaleString()} left)
      </button>
    </div>
  );
};

export default ShowMore;
