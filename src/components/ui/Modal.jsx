import React, { useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

/**
 * Modal Component
 * 
 * A reusable modal component with focus management, keyboard navigation, and animations.
 * 
 * @param {boolean} isOpen - Whether modal is open
 * @param {function} onClose - Callback when modal should close
 * @param {React.ReactNode} children - Modal content
 * @param {string} size - Modal size: 'sm', 'md', 'lg', 'xl', 'full'
 * @param {string} className - Additional CSS classes
 */
const Modal = ({ 
  isOpen, 
  onClose, 
  children, 
  size = 'md',
  className = '',
}) => {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-full mx-4',
  };

  // Focus management and keyboard navigation
  useEffect(() => {
    if (isOpen) {
      // Store previously focused element
      previousFocusRef.current = document.activeElement;
      
      // Focus first focusable element in modal
      const modal = modalRef.current;
      if (modal) {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    } else {
      // Return focus to previously focused element
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTab);
    return () => modal.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/75 flex items-center justify-center z-50 p-4 overflow-y-auto backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={clsx(
          'bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/8 shadow-xl w-full mx-auto my-4 max-h-[90vh] overflow-y-auto',
          'transform transition-all duration-200 ease-out',
          'animate-in fade-in zoom-in-95',
          sizes[size] || sizes.md,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * Modal Header Component
 */
Modal.Header = ({ children, onClose, className = '' }) => (
  <div className={clsx('flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/8', className)}>
    <div className="flex-1">{children}</div>
    {onClose && (
      <button
        onClick={onClose}
        className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
        aria-label="Close modal"
      >
        <XMarkIcon className="w-5 h-5" aria-hidden="true" />
      </button>
    )}
  </div>
);

/**
 * Modal Title Component
 */
Modal.Title = ({ children, className = '', id = 'modal-title' }) => (
  <h3 className={clsx('text-lg font-semibold text-gray-900 dark:text-white', className)} id={id}>
    {children}
  </h3>
);

/**
 * Modal Body Component
 */
Modal.Body = ({ children, className = '' }) => (
  <div className={clsx('p-6', className)}>
    {children}
  </div>
);

/**
 * Modal Footer Component
 */
Modal.Footer = ({ children, className = '' }) => (
  <div className={clsx('flex justify-end space-x-3 px-6 py-4 bg-gray-50 dark:bg-white/3 rounded-b-2xl border-t border-gray-200 dark:border-white/8', className)}>
    {children}
  </div>
);

export default Modal;
