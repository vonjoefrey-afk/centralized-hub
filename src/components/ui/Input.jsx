import React, { forwardRef } from 'react';
import clsx from 'clsx';
import { ExclamationCircleIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

/**
 * Input Component
 * 
 * A reusable input component with validation states, error messages, and password visibility toggle.
 * 
 * @param {string} type - Input type: 'text', 'email', 'password', etc.
 * @param {string} label - Input label
 * @param {string} error - Error message to display
 * @param {boolean} success - Shows success state
 * @param {string} helperText - Helper text below input
 * @param {boolean} showPasswordToggle - Shows password visibility toggle (for password inputs)
 * @param {string} className - Additional CSS classes
 * @param {object} props - Other input props
 */
const Input = forwardRef(({ 
  type = 'text',
  label,
  error,
  success = false,
  helperText,
  showPasswordToggle = false,
  className = '',
  ...props 
}, ref) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  const hasError = !!error;
  const hasSuccess = success && !hasError;

  const inputClasses = clsx(
    'w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    'transition-all duration-200',
    'disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500',
    {
      'border-gray-300 focus:border-blue-500 focus:ring-blue-500': !hasError && !hasSuccess,
      'border-red-500 focus:border-red-500 focus:ring-red-500': hasError,
      'border-green-500 focus:border-green-500 focus:ring-green-500': hasSuccess,
      'pr-10': isPassword && showPasswordToggle,
    },
    className
  );

  return (
    <div className="w-full">
      {label && (
        <label 
          htmlFor={props.id} 
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={ref}
          type={inputType}
          className={inputClasses}
          aria-invalid={hasError}
          aria-describedby={
            error ? `${props.id}-error` : 
            helperText ? `${props.id}-helper` : 
            undefined
          }
          {...props}
        />
        
        {hasError && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
          </div>
        )}
        
        {hasSuccess && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <CheckCircleIcon className="h-5 w-5 text-green-500" aria-hidden="true" />
          </div>
        )}
        
        {isPassword && showPasswordToggle && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
            ) : (
              <EyeIcon className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      
      {error && (
        <p 
          id={props.id ? `${props.id}-error` : undefined}
          className="mt-1 text-sm text-red-600 flex items-center" 
          role="alert"
        >
          <ExclamationCircleIcon className="w-4 h-4 mr-1 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      
      {helperText && !error && (
        <p 
          id={props.id ? `${props.id}-helper` : undefined}
          className="mt-1 text-sm text-gray-500"
        >
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
