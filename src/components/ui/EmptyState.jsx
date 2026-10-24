import React from 'react';
import Button from './Button';

/**
 * EmptyState Component
 * 
 * A component for displaying empty states with helpful messaging and actions.
 * 
 * @param {React.ReactNode} icon - Icon component to display
 * @param {string} title - Title text
 * @param {string} description - Description text
 * @param {string} actionLabel - Label for action button
 * @param {function} onAction - Callback when action button is clicked
 * @param {React.ReactNode} children - Additional content
 * @param {string} className - Additional CSS classes
 */
const EmptyState = ({ 
  icon,
  title,
  description,
  actionLabel,
  onAction,
  children,
  className = '',
}) => {
  return (
    <div className={`text-center py-12 px-4 ${className}`}>
      {icon && (
        <div className="mx-auto w-16 h-16 text-gray-400 mb-4 flex items-center justify-center">
          {icon}
        </div>
      )}
      {title && (
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">{description}</p>
      )}
      {children && (
        <div className="mb-6">{children}</div>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
