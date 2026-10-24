import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

/**
 * Tooltip Component
 * 
 * A simple tooltip component that displays helpful information on hover.
 * 
 * @param {React.ReactNode} children - Element to attach tooltip to
 * @param {string} content - Tooltip text content
 * @param {string} position - Tooltip position: 'top', 'bottom', 'left', 'right'
 * @param {string} className - Additional CSS classes
 */
const Tooltip = ({ 
  children, 
  content, 
  position = 'top',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (isVisible && tooltipRef.current && wrapperRef.current) {
      const tooltip = tooltipRef.current;
      const wrapper = wrapperRef.current;
      
      // Position calculation
      const wrapperRect = wrapper.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      switch (position) {
        case 'top':
          tooltip.style.bottom = `${wrapperRect.height + 8}px`;
          tooltip.style.left = `${(wrapperRect.width - tooltipRect.width) / 2}px`;
          break;
        case 'bottom':
          tooltip.style.top = `${wrapperRect.height + 8}px`;
          tooltip.style.left = `${(wrapperRect.width - tooltipRect.width) / 2}px`;
          break;
        case 'left':
          tooltip.style.right = `${wrapperRect.width + 8}px`;
          tooltip.style.top = `${(wrapperRect.height - tooltipRect.height) / 2}px`;
          break;
        case 'right':
          tooltip.style.left = `${wrapperRect.width + 8}px`;
          tooltip.style.top = `${(wrapperRect.height - tooltipRect.height) / 2}px`;
          break;
        default:
          break;
      }
    }
  }, [isVisible, position]);

  if (!content) return children;

  return (
    <div
      ref={wrapperRef}
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={clsx(
            'absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg whitespace-nowrap',
            'animate-in fade-in duration-200',
            className
          )}
          style={{ pointerEvents: 'none' }}
        >
          {content}
          <div
            className={clsx(
              'absolute w-2 h-2 bg-gray-900 transform rotate-45',
              position === 'top' && 'bottom-[-4px] left-1/2 -translate-x-1/2',
              position === 'bottom' && 'top-[-4px] left-1/2 -translate-x-1/2',
              position === 'left' && 'right-[-4px] top-1/2 -translate-y-1/2',
              position === 'right' && 'left-[-4px] top-1/2 -translate-y-1/2'
            )}
          />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
