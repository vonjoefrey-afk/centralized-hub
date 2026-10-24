import React from 'react';
import clsx from 'clsx';
import { 
  CheckCircleIcon, 
  ExclamationCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

/**
 * Alert Component
 * 
 * A reusable alert component for displaying messages, errors, and notifications.
 * 
 * @param {string} variant - Alert variant: 'success', 'error', 'warning', 'info'
 * @param {string} title - Alert title
 * @param {React.ReactNode} children - Alert content
 * @param {boolean} dismissible - Shows dismiss button
 * @param {function} onDismiss - Callback when dismissed
 * @param {string} className - Additional CSS classes
 */
const Alert = ({ 
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  className = '',
}) => {
  const variants = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: 'text-green-400',
      title: 'text-green-800',
      text: 'text-green-700',
      iconComponent: CheckCircleIcon,
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'text-red-400',
      title: 'text-red-800',
      text: 'text-red-700',
      iconComponent: ExclamationCircleIcon,
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: 'text-yellow-400',
      title: 'text-yellow-800',
      text: 'text-yellow-700',
      iconComponent: ExclamationTriangleIcon,
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'text-blue-400',
      title: 'text-blue-800',
      text: 'text-blue-700',
      iconComponent: InformationCircleIcon,
    },
  };
  
  const styles = variants[variant] || variants.info;
  const IconComponent = styles.iconComponent;
  
  return (
    <div
      className={clsx(
        'rounded-md border p-4',
        styles.bg,
        styles.border,
        className
      )}
      role="alert"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <IconComponent className={clsx('h-5 w-5', styles.icon)} aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={clsx('text-sm font-medium mb-1', styles.title)}>
              {title}
            </h3>
          )}
          <div className={clsx('text-sm', styles.text)}>
            {children}
          </div>
        </div>
        {dismissible && (
          <div className="ml-auto pl-3">
            <button
              type="button"
              className={clsx(
                'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2',
                styles.icon,
                `focus:ring-${variant === 'success' ? 'green' : variant === 'error' ? 'red' : variant === 'warning' ? 'yellow' : 'blue'}-500`
              )}
              onClick={onDismiss}
              aria-label="Dismiss alert"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alert;
