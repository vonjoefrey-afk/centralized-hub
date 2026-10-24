import React from 'react';
import clsx from 'clsx';

/**
 * Card Component
 * 
 * A reusable card component with consistent styling and hover effects.
 * 
 * @param {React.ReactNode} children - Card content
 * @param {string} className - Additional CSS classes
 * @param {boolean} hover - Enables hover shadow effect
 * @param {boolean} padding - Adds padding (default: true)
 * @param {object} props - Other div props
 */
const Card = ({ 
  children, 
  className = '',
  hover = false,
  padding = true,
  ...props 
}) => {
  return (
    <div
      className={clsx(
        'glass-card rounded-2xl',
        'transition-shadow duration-200',
        {
          'hover:shadow-md dark:hover:shadow-none dark:hover:border-white/12': hover,
          'p-6': padding,
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * Card Header Component
 */
Card.Header = ({ children, className = '', ...props }) => (
  <div className={clsx('mb-4', className)} {...props}>
    {children}
  </div>
);

/**
 * Card Title Component
 */
Card.Title = ({ children, className = '', ...props }) => (
  <h3 className={clsx('text-lg font-semibold text-gray-900 dark:text-gray-100', className)} {...props}>
    {children}
  </h3>
);

/**
 * Card Body Component
 */
Card.Body = ({ children, className = '', ...props }) => (
  <div className={clsx('text-sm text-gray-600 dark:text-gray-400', className)} {...props}>
    {children}
  </div>
);

/**
 * Card Footer Component
 */
Card.Footer = ({ children, className = '', ...props }) => (
  <div className={clsx('mt-4 pt-4 border-t border-gray-200 dark:border-white/7', className)} {...props}>
    {children}
  </div>
);

export default Card;
