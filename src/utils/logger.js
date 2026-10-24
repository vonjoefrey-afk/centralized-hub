/**
 * Logger Utility
 * 
 * Centralized logging utility that:
 * - Only logs in development mode (removes logs from production)
 * - Always logs errors (critical for debugging production issues)
 * - Provides consistent logging interface
 * - Prevents sensitive data exposure in production
 */

const isDevelopment = import.meta.env.DEV;

/**
 * Logger object with different log levels
 */
export const logger = {
  /**
   * Log debug/info messages (only in development)
   * @param {...any} args - Arguments to log
   */
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log error messages (always logged, even in production)
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    console.error(...args);
    // Errors are automatically sent to Cloud Logging via errorHandler utility
  },

  /**
   * Log warning messages (only in development)
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Log debug messages (only in development)
   * @param {...any} args - Arguments to log
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Log info messages (only in development)
   * @param {...any} args - Arguments to log
   */
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Group related logs together (only in development)
   * @param {string} label - Group label
   */
  group: (label) => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  /**
   * End a log group (only in development)
   */
  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  }
};

export default logger;
