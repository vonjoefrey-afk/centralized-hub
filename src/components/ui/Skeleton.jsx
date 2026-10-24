import React from 'react';
import clsx from 'clsx';

/**
 * Skeleton Component
 * 
 * A loading placeholder component that displays animated skeleton placeholders.
 * 
 * @param {string} variant - Skeleton variant: 'text', 'circular', 'rectangular'
 * @param {number} lines - Number of lines for text variant
 * @param {string} width - Width of skeleton (e.g., 'w-full', 'w-1/2', 'w-64')
 * @param {string} height - Height of skeleton (e.g., 'h-4', 'h-8', 'h-12')
 * @param {string} className - Additional CSS classes
 */
const Skeleton = ({ 
  variant = 'text',
  lines = 1,
  width = 'w-full',
  height = 'h-4',
  className = '',
}) => {
  if (variant === 'text') {
    return (
      <div className={clsx('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={clsx(
              'animate-pulse bg-gray-200 rounded',
              width,
              height,
              index === lines - 1 && width !== 'w-full' ? 'w-3/4' : ''
            )}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }
  
  if (variant === 'circular') {
    return (
      <div
        className={clsx(
          'animate-pulse bg-gray-200 rounded-full',
          width,
          height,
          className
        )}
        aria-hidden="true"
      />
    );
  }
  
  // rectangular (default)
  return (
    <div
      className={clsx(
        'animate-pulse bg-gray-200 rounded',
        width,
        height,
        className
      )}
      aria-hidden="true"
    />
  );
};

/**
 * TableSkeleton Component
 * 
 * A skeleton component specifically for table loading states.
 */
export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex space-x-4">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton
            key={colIndex}
            width={colIndex === 0 ? 'w-1/4' : 'w-full'}
            height="h-10"
          />
        ))}
      </div>
    ))}
  </div>
);

/**
 * CardSkeleton Component
 * 
 * A skeleton component specifically for card loading states.
 */
export const CardSkeleton = ({ count = 3 }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="bg-white rounded-lg shadow-md p-6">
        <Skeleton variant="circular" width="w-12" height="h-12" className="mb-4" />
        <Skeleton lines={2} className="mb-2" />
        <Skeleton width="w-1/2" />
      </div>
    ))}
  </div>
);

export default Skeleton;
