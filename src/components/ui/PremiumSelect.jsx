import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { findTypeaheadMatch } from '../../utils/typeahead';

// Keys typed within this window are combined ("s" then "e" → "se").
const TYPEAHEAD_RESET_MS = 700;

const optValueOf = (opt) => (typeof opt === 'string' ? opt : opt.value);
const optLabelOf = (opt) => (typeof opt === 'string' ? opt : opt.label);
const optTextOf = (opt) => {
  const label = optLabelOf(opt);
  return typeof label === 'string' || typeof label === 'number' ? String(label) : String(optValueOf(opt) ?? '');
};

/**
 * PremiumSelect Component
 *
 * A high-end, glassmorphic dropdown/select component designed for premium UIs.
 * Uses a React Portal to render the dropdown at document body level, fully
 * escaping any parent stacking context created by backdrop-filter or transform.
 *
 * Keyboard (like a native <select>): with the trigger focused, type letters to
 * jump to the matching option ("s", "se" → "SEK"; repeat a letter to cycle),
 * ↑/↓/Home/End/PageUp/PageDown move the highlight, Enter or Space picks it,
 * Escape or Tab closes. Focus stays on the trigger (aria-activedescendant).
 */
const PremiumSelect = ({
  label,
  value,
  options = [],
  onChange,
  placeholder = 'Select option...',
  className = '',
  menuClassName = '',
  icon,
  align = 'left',
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const [highlight, setHighlight] = useState(-1);
  const [listMaxHeight, setListMaxHeight] = useState(256);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);
  const typeahead = useRef({ buffer: '', at: 0 });
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (i) => `${baseId}-opt-${i}`;
  const selectedIndex = options.findIndex((opt) => optValueOf(opt) === value);

  const sizes = {
    sm: 'px-2 py-1 text-[10px] rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-2xl'
  };

  const sizeClass = sizes[size] || sizes.md;

  // Compute menu position from trigger bounding rect on open
  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const MENU_MAX = 256; // matches the former max-h-64
    const openUpward = spaceBelow < MENU_MAX + 16 && spaceAbove > spaceBelow;
    // Never let the list run past the window edge: shrink it to the space available.
    setListMaxHeight(Math.max(120, Math.min(MENU_MAX, (openUpward ? spaceAbove : spaceBelow) - 16)));

    setMenuStyle({
      position: 'fixed',
      zIndex: 99999,
      width: Math.max(rect.width, 160),
      ...(align === 'right'
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left }),
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, [align]);

  const openMenu = (initialHighlight = selectedIndex) => {
    computePosition();
    setHighlight(initialHighlight);
    setIsOpen(true);
  };

  const handleOpen = () => {
    if (isOpen) setIsOpen(false);
    else openMenu();
  };

  const choose = (index) => {
    const opt = options[index];
    if (opt === undefined) return;
    onChange(optValueOf(opt));
    setIsOpen(false);
  };

  // Keep the highlighted option visible while moving through a long list.
  useEffect(() => {
    if (isOpen && highlight >= 0) optionRefs.current[highlight]?.scrollIntoView?.({ block: 'nearest' });
  }, [isOpen, highlight]);

  const handleKeyDown = (e) => {
    if (!options.length) return;
    const last = options.length - 1;
    const move = (to) => {
      e.preventDefault();
      if (!isOpen) openMenu(Math.min(Math.max(to, 0), last));
      else setHighlight(Math.min(Math.max(to, 0), last));
    };
    const from = isOpen ? highlight : selectedIndex;

    switch (e.key) {
      case 'ArrowDown': return move(from < 0 ? 0 : from + 1);
      case 'ArrowUp': return move(from < 0 ? last : from - 1);
      case 'Home': return move(0);
      case 'End': return move(last);
      case 'PageDown': return move((from < 0 ? 0 : from) + 10);
      case 'PageUp': return move((from < 0 ? 0 : from) - 10);
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlight >= 0) choose(highlight);
        else if (isOpen) setIsOpen(false);
        else openMenu();
        return;
      case ' ':
        // Space types a space while a typeahead word is in progress; otherwise it picks/opens.
        if (typeahead.current.buffer && Date.now() - typeahead.current.at < TYPEAHEAD_RESET_MS) break;
        e.preventDefault();
        if (isOpen && highlight >= 0) choose(highlight);
        else if (!isOpen) openMenu();
        return;
      case 'Escape':
        if (isOpen) { e.preventDefault(); e.stopPropagation(); setIsOpen(false); }
        return;
      case 'Tab':
        if (isOpen) setIsOpen(false);
        return;
      default:
        break;
    }

    // Type-to-select: printable characters without Ctrl/Alt/Meta.
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const now = Date.now();
      const t = typeahead.current;
      t.buffer = now - t.at < TYPEAHEAD_RESET_MS ? t.buffer + e.key : e.key;
      t.at = now;
      const match = findTypeaheadMatch(options.map(optTextOf), t.buffer, from);
      if (match >= 0) {
        if (!isOpen) openMenu(match);
        else setHighlight(match);
      } else if (!isOpen) {
        openMenu();
      }
    }
  };

  // Close on outside click / scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (
        triggerRef.current && !triggerRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleScroll = () => computePosition();
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen, computePosition]);

  const selectedOption = options.find(opt =>
    (typeof opt === 'string' ? opt : opt.value) === value
  );

  const displayValue = selectedOption
    ? (typeof selectedOption === 'string' ? selectedOption : selectedOption.label)
    : placeholder;

  return (
    <div className="relative inline-block text-left w-full">
      {label && (
        <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-2 ml-1">
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={isOpen && highlight >= 0 ? optionId(highlight) : undefined}
        className={clsx(
          'flex items-center justify-between w-full transition-all duration-300',
          'bg-white/70 dark:bg-white/5 border border-gray-100 dark:border-white/10 backdrop-blur-md',
          'font-semibold text-gray-700 dark:text-gray-200',
          'hover:border-indigo-500/50 dark:hover:border-indigo-400/50 hover:shadow-lg hover:shadow-indigo-500/10',
          'active:scale-[0.98] outline-none',
          isOpen && 'ring-2 ring-indigo-500/20 border-indigo-500/50 bg-white dark:bg-white/10',
          sizeClass,
          className
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="shrink-0 text-indigo-500">{icon}</span>}
          <span className="truncate">{displayValue}</span>
        </div>
        <ChevronDownIcon
          className={clsx(
            'w-4 h-4 ml-2 text-gray-400 transition-transform duration-300 flex-shrink-0',
            isOpen && 'rotate-180 text-indigo-500'
          )}
        />
      </button>

      {/* Portal: renders menu directly at document.body to escape stacking contexts */}
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="premium-select-menu"
              ref={menuRef}
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              style={menuStyle}
              id={listboxId}
              role="listbox"
              className={clsx(
                'rounded-2xl overflow-hidden shadow-2xl shadow-black/30 dark:shadow-black/70',
                'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10',
                menuClassName
              )}
            >
              <div className="py-1.5 overflow-y-auto" style={{ maxHeight: listMaxHeight }}>
                {options.length === 0 ? (
                  <div className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-center tracking-widest">
                    No options
                  </div>
                ) : (
                  options.map((opt, idx) => {
                    const optLabel = optLabelOf(opt);
                    const isActive = optValueOf(opt) === value;
                    const isHighlighted = idx === highlight;

                    return (
                      <button
                        key={idx}
                        ref={(el) => { optionRefs.current[idx] = el; }}
                        id={optionId(idx)}
                        type="button"
                        role="option"
                        tabIndex={-1}
                        aria-selected={isActive}
                        onMouseDown={(e) => e.preventDefault() /* keep focus on the trigger */}
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => {
                          choose(idx);
                          triggerRef.current?.focus();
                        }}
                        className={clsx(
                          'w-full flex items-center px-4 py-2.5 text-sm font-semibold transition-all duration-150 text-left',
                          isActive
                            ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
                          isHighlighted && !isActive && 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white',
                          isHighlighted && isActive && 'ring-2 ring-inset ring-indigo-500/40'
                        )}
                      >
                        <span className="flex-1 truncate">{optLabel}</span>
                        {isActive && (
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 ml-2 animate-pulse" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default PremiumSelect;
