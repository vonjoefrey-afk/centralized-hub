import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * PremiumSelect Component
 *
 * A high-end, glassmorphic dropdown/select component designed for premium UIs.
 * Uses a React Portal to render the dropdown at document body level, fully
 * escaping any parent stacking context created by backdrop-filter or transform.
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
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

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
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;

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

  const handleOpen = () => {
    if (!isOpen) computePosition();
    setIsOpen(prev => !prev);
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
        aria-haspopup="listbox"
        aria-expanded={isOpen}
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
              role="listbox"
              className={clsx(
                'rounded-2xl overflow-hidden shadow-2xl shadow-black/30 dark:shadow-black/70',
                'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10',
                menuClassName
              )}
            >
              <div className="py-1.5 max-h-64 overflow-y-auto">
                {options.length === 0 ? (
                  <div className="px-4 py-3 text-xs font-bold text-gray-400 uppercase text-center tracking-widest">
                    No options
                  </div>
                ) : (
                  options.map((opt, idx) => {
                    const optValue = typeof opt === 'string' ? opt : opt.value;
                    const optLabel = typeof opt === 'string' ? opt : opt.label;
                    const isActive = optValue === value;

                    return (
                      <button
                        key={idx}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          onChange(optValue);
                          setIsOpen(false);
                        }}
                        className={clsx(
                          'w-full flex items-center px-4 py-2.5 text-sm font-semibold transition-all duration-150 text-left',
                          isActive
                            ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
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
