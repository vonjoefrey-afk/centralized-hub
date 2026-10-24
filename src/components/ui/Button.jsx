import React from 'react';
import clsx from 'clsx';

/**
 * Button Component
 * 
 * A reusable button component with multiple variants, sizes, and states.
 * 
 * @param {string} variant - Button style variant: 'primary', 'secondary', 'danger', 'ghost'
 * @param {string} size - Button size: 'sm', 'md', 'lg'
 * @param {boolean} loading - Shows loading spinner and disables button
 * @param {boolean} disabled - Disables the button
 * @param {React.ReactNode} children - Button content
 * @param {string} className - Additional CSS classes
 * @param {object} props - Other button props
 */
const Button = ({ 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  disabled = false,
  children,
  className = '',
  ...props 
}) => {
  const variants = {
    primary:   'bg-accent hover:brightness-110 active:brightness-95 text-white border-transparent',
    hero:      'gradient-accent hover:brightness-110 active:brightness-95 text-white border-transparent shadow-lg shadow-accent/25',
    secondary: 'bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/15 active:bg-gray-400 text-gray-900 dark:text-gray-100 border-transparent',
    danger:    'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-transparent',
    ghost:     'bg-transparent hover:bg-gray-100 dark:hover:bg-white/8 active:bg-gray-200 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-white/15',
    success:   'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white border-transparent',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  
  const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-[#111] disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = variants[variant] || variants.primary;
  const sizeClasses = sizes[size] || sizes.md;
  const focusRingClasses = variant === 'danger' ? 'focus:ring-red-500' :
                           variant === 'success' ? 'focus:ring-green-500' :
                           (variant === 'primary' || variant === 'hero') ? 'focus:ring-accent' :
                           'focus:ring-gray-500';
  
  return (
    <button
      className={clsx(
        baseClasses,
        variantClasses,
        sizeClasses,
        focusRingClasses,
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center">
          <svg 
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" 
            fill="none" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
