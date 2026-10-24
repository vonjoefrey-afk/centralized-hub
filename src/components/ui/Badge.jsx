import React from 'react';
import clsx from 'clsx';

/**
 * Badge Component — Premium Dark-Mode-Aware
 *
 * @param {string} variant - 'primary' | 'success' | 'warning' | 'error' | 'info' | 'gray'
 * @param {string} size    - 'sm' | 'md' | 'lg'
 * @param {string} color   - Legacy colour prop (maps to variant)
 */
const Badge = ({
  variant = 'primary',
  size = 'md',
  color,          // legacy support
  children,
  className = '',
  ...props
}) => {
  // Map legacy `color` prop → variant
  const resolvedVariant = color
    ? ({ blue: 'primary', green: 'success', yellow: 'warning', red: 'error', gray: 'gray' }[color] ?? variant)
    : variant;

  const variants = {
    primary: 'bg-blue-100   text-blue-800   dark:bg-blue-500/15   dark:text-blue-300',
    success: 'bg-green-100  text-green-800  dark:bg-green-500/15  dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300',
    error:   'bg-red-100    text-red-800    dark:bg-red-500/15    dark:text-red-400',
    info:    'bg-cyan-100   text-cyan-800   dark:bg-cyan-500/15   dark:text-cyan-300',
    gray:    'bg-gray-100   text-gray-700   dark:bg-white/8       dark:text-gray-400',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-sm',
    lg: 'px-3 py-1 text-base',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center font-semibold rounded-full tracking-wide',
        variants[resolvedVariant] ?? variants.primary,
        sizes[size] ?? sizes.md,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
