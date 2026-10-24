/**
 * Error Handler Utility
 * 
 * Centralized error handling utilities for consistent error management
 * across the application.
 * 
 * Note: This file imports logger, but logger itself doesn't import errorHandler
 * to avoid circular dependencies.
 */

import { logger } from './logger';
import { logError } from './gcp-logging';

/**
 * Firebase/Firestore error code to user-friendly message mapping
 */
const ERROR_MESSAGES = {
  // Authentication errors
  'auth/user-not-found': 'No account found with this email address.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password is too weak. Please use a stronger password.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/requires-recent-login': 'For security reasons, please sign in again.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/network-request-failed': 'Network error. Please check your internet connection.',
  
  // Firestore errors
  'permission-denied': 'You do not have permission to perform this action.',
  'not-found': 'The requested resource was not found.',
  'unavailable': 'Service temporarily unavailable. Please try again.',
  'deadline-exceeded': 'Request timed out. Please try again.',
  'unauthenticated': 'Please sign in to continue.',
  'failed-precondition': 'Operation cannot be completed. Please try again.',
  'aborted': 'Operation was cancelled.',
  'out-of-range': 'The operation is out of range.',
  'unimplemented': 'This operation is not yet implemented.',
  'internal': 'An internal error occurred. Please try again.',
  'resource-exhausted': 'Resource limit exceeded. Please try again later.',
  'cancelled': 'Operation was cancelled.',
  'data-loss': 'Data loss occurred. Please refresh and try again.',
  'already-exists': 'This resource already exists.',
  'invalid-argument': 'Invalid input provided. Please check your data.',
  
  // Custom errors
  'user-deleted': 'This account has been deleted by an administrator.',
};

/**
 * Convert Firebase/Firestore error to user-friendly message
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
export const getErrorMessage = (error) => {
  if (!error) {
    return 'An unexpected error occurred. Please try again.';
  }

  // Check for custom error code first
  if (error.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }

  // Check Firebase Auth error code
  if (error.code && error.code.startsWith('auth/')) {
    return ERROR_MESSAGES[error.code] || error.message || 'Authentication error occurred.';
  }

  // Check Firestore error code
  if (error.code) {
    return ERROR_MESSAGES[error.code] || error.message || 'An error occurred. Please try again.';
  }

  // Fallback to error message if available
  return error.message || 'An unexpected error occurred. Please try again.';
};

/**
 * Handle Firestore/Firebase errors with proper logging and user-friendly messages
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred (e.g., "signIn", "createUpdate")
 * @returns {Error} Formatted error with user-friendly message
 */
export const handleFirestoreError = (error, context = 'operation') => {
  const userMessage = getErrorMessage(error);
  
  // Always log errors for debugging
  logger.error(`Error in ${context}:`, {
    error,
    code: error.code,
    message: error.message,
    userMessage,
  });

  // Send to Cloud Logging (only for unexpected/important errors)
  // The logError function now handles filtering internally (rate limiting, deduplication, expected errors)
  // So we can call it for all errors - it will decide what to send
  // This ensures we don't miss important errors while still optimizing costs
  logError(error, {
    context,
    errorCode: error.code,
    userMessage,
    originalMessage: error.message,
    operation: context, // Add operation context for better deduplication
  });

  // Create new error with user-friendly message
  const friendlyError = new Error(userMessage);
  friendlyError.code = error.code;
  friendlyError.originalError = error;
  
  return friendlyError;
};

/**
 * Wrapper function to handle async operations with error handling
 * @param {Function} operation - Async operation to execute
 * @param {string} errorContext - Context for error messages
 * @returns {Promise} Result of the operation
 */
export const withErrorHandling = async (operation, errorContext = 'operation') => {
  try {
    return await operation();
  } catch (error) {
    throw handleFirestoreError(error, errorContext);
  }
};

/**
 * Retry an operation with exponential backoff
 * @param {Function} operation - Async operation to retry
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} initialDelay - Initial delay in ms (default: 1000)
 * @returns {Promise} Result of the operation
 */
export const retryOperation = async (operation, maxRetries = 3, initialDelay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.code === 'permission-denied' || error.code === 'not-found' || error.code === 'unauthenticated') {
        throw error;
      }
      
      // If last retry, throw the error
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // Wait before retrying with exponential backoff
      const delay = initialDelay * Math.pow(2, i);
      logger.debug(`Retrying operation (attempt ${i + 2}/${maxRetries}) after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Add timeout to a promise
 * @param {Promise} promise - Promise to add timeout to
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} errorMessage - Custom timeout error message
 * @returns {Promise} Promise with timeout
 */
export const withTimeout = (promise, timeoutMs = 30000, errorMessage = 'Operation timed out') => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
};

export default {
  getErrorMessage,
  handleFirestoreError,
  withErrorHandling,
  retryOperation,
  withTimeout,
};
