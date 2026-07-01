import { useState, useRef, useEffect } from 'react';
import './Dropdown.css';

/**
 * Generic single-select dropdown with click-outside-to-close. Replaces the
 * three hand-rolled, near-identical filter/sort/order dropdowns (each with its
 * own ref + click-outside effect) that lived in VideosPage.
 *
 * @param {string} value                    currently selected option value
 * @param {{value:string,label:string}[]} options
 * @param {(value:string)=>void} onSelect
 * @param {string} placeholder              shown when no option matches `value`
 */
const Dropdown = ({ value, options, onSelect, placeholder = 'None' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="dropdown-trigger" onClick={() => setOpen((v) => !v)}>
        <span className={selectedLabel ? 'dropdown-selected' : 'dropdown-placeholder'}>
          {selectedLabel || placeholder}
        </span>
        <svg className={`dropdown-arrow ${open ? 'open' : ''}`} width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="dropdown-menu">
          {options.map((option) => (
            <div
              key={option.value}
              className={`dropdown-option ${value === option.value ? 'active' : ''}`}
              onClick={() => {
                onSelect(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
