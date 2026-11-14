import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

/**
 * Lets a page put its own buttons into the header (the Home page's Add Star,
 * Shuffle and Sort) while keeping their state in the page.
 *
 * App provides { slot, setSlot }; the Header hands setSlot its slot element,
 * and pages render <HeaderPageActions> into it.
 */
export const HeaderSlotContext = createContext(undefined);

/**
 * Render `children` in the header's page-actions slot. Outside an app with a
 * header (tests, or a page rendered on its own) they render in place instead.
 */
export const HeaderPageActions = ({ children }) => {
  const context = useContext(HeaderSlotContext);
  if (context === undefined) return <div className="page-actions-inline">{children}</div>;
  // The slot appears once the header has rendered; until then, nothing.
  return context.slot ? createPortal(children, context.slot) : null;
};
