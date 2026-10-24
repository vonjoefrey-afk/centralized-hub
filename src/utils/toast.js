/**
 * Toast Notification Utilities
 * 
 * Wrapper around react-hot-toast for consistent toast notifications.
 * Uses toast IDs to prevent duplicate toasts and ensure only one toast per type is shown.
 */

import toast from 'react-hot-toast';

// Toast IDs for managing single toasts per type
const TOAST_IDS = {
  SUCCESS: 'app-success-toast',
  ERROR: 'app-error-toast',
  INFO: 'app-info-toast',
  WARNING: 'app-warning-toast',
};

/**
 * Show success toast (dismisses all existing toasts first, then shows new one)
 * @param {string} message - Success message
 * @param {object} options - Toast options
 */
export const showSuccess = (message, options = {}) => {
  // Don't show toast for empty messages (used for clearing)
  if (!message || message.trim() === '') {
    return;
  }
  
  // Dismiss ALL existing toasts first to prevent stacking
  toast.dismiss();
  
  // Use setTimeout to ensure dismissal completes before showing new toast
  return setTimeout(() => {
    toast.success(message, {
      id: TOAST_IDS.SUCCESS,
      duration: options.duration || 4000,
      ...options,
    });
  }, 0);
};

/**
 * Show error toast (dismisses all existing toasts first, then shows new one)
 * @param {string} message - Error message
 * @param {object} options - Toast options
 */
export const showError = (message, options = {}) => {
  // Don't show toast for empty messages (used for clearing)
  if (!message || message.trim() === '') {
    return;
  }
  
  // Dismiss ALL existing toasts first to prevent stacking
  toast.dismiss();
  
  // Use setTimeout to ensure dismissal completes before showing new toast
  return setTimeout(() => {
    toast.error(message, {
      id: TOAST_IDS.ERROR,
      duration: options.duration || 5000,
      ...options,
    });
  }, 0);
};

/**
 * Show warning toast (replaces any existing toast)
 * @param {string} message - Warning message
 * @param {object} options - Toast options
 */
export const showWarning = (message, options = {}) => {
  // Don't show toast for empty messages
  if (!message || message.trim() === '') {
    return;
  }
  
  // Dismiss ALL existing toasts first to prevent stacking
  toast.dismiss();
  
  // Show new toast with unique ID
  return toast(message, {
    id: TOAST_IDS.WARNING,
    icon: '⚠️',
    duration: options.duration || 4000,
    style: {
      background: '#fffbeb',
      color: '#92400e',
    },
    ...options,
  });
};

/**
 * Show info toast (replaces any existing toast)
 * @param {string} message - Info message
 * @param {object} options - Toast options
 */
export const showInfo = (message, options = {}) => {
  // Don't show toast for empty messages
  if (!message || message.trim() === '') {
    return;
  }
  
  // Dismiss ALL existing toasts first to prevent stacking
  toast.dismiss();
  
  // Show new toast with unique ID
  return toast(message, {
    id: TOAST_IDS.INFO,
    icon: 'ℹ️',
    duration: options.duration || 4000,
    style: {
      background: '#eff6ff',
      color: '#1e40af',
    },
    ...options,
  });
};

/**
 * Show loading toast
 * @param {string} message - Loading message
 * @returns {string} Toast ID for dismissing or updating
 */
export const showLoading = (message = 'Loading...') => {
  return toast.loading(message);
};

/**
 * Show promise toast (handles async operations)
 * @param {Promise} promise - Promise to handle
 * @param {object} messages - Messages for different states
 * @returns {Promise}
 */
export const showPromise = (promise, messages) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading || 'Loading...',
      success: messages.success || 'Success!',
      error: messages.error || 'An error occurred',
    }
  );
};

/**
 * Dismiss toast
 * @param {string} toastId - Toast ID to dismiss
 */
export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

/**
 * Dismiss all toasts
 */
export const dismissAll = () => {
  toast.dismiss();
};

export default {
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  loading: showLoading,
  promise: showPromise,
  dismiss: dismissToast,
  dismissAll,
};
