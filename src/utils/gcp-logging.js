/**
 * Google Cloud Logging Integration - OPTIMIZED FOR COST
 * 
 * This module handles error logging and monitoring using Google Cloud native services:
 * - Cloud Logging: For structured log entries
 * - Error Reporting: Automatically detects errors from Cloud Logging
 * 
 * COST OPTIMIZATION FEATURES:
 * - Only ERROR and CRITICAL severity logs are sent to Cloud Logging
 * - Rate limiting to prevent excessive API calls
 * - Error deduplication to prevent logging same error multiple times
 * - Filters out expected/common errors
 * - Configurable logging levels
 * 
 * WHERE TO SEE LOGS:
 * - Cloud Logging: https://console.cloud.google.com/logs (Filter by resource: Cloud Functions)
 * - Error Reporting: https://console.cloud.google.com/errors (Automatic error aggregation)
 * - Cloud Monitoring: https://console.cloud.google.com/monitoring (Metrics and dashboards)
 */

import { logger } from './logger';

/**
 * Log level constants matching Google Cloud Logging severity levels
 */
export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
};

/**
 * Configuration for logging behavior
 * Can be overridden via environment variables
 */
const LOGGING_CONFIG = {
  // Only send ERROR and CRITICAL to Cloud Logging (cost optimization)
  // INFO, WARNING, DEBUG only go to console
  SEND_TO_CLOUD: ['ERROR', 'CRITICAL'],

  // Rate limiting: max logs per minute per error type
  MAX_LOGS_PER_MINUTE: 10,

  // Deduplication: prevent logging same error within this time (ms)
  DEDUPE_WINDOW_MS: 60000, // 1 minute

  // Enable/disable Cloud Logging entirely
  ENABLED: import.meta.env.REACT_APP_ENABLE_CLOUD_LOGGING !== 'false',

  // Minimum severity to send to Cloud Logging
  MIN_SEVERITY: 'ERROR',
};

/**
 * Rate limiting and deduplication storage
 */
const logCache = new Map();
const rateLimitCache = new Map();

/**
 * Generate a unique key for error deduplication
 */
const getErrorKey = (error, context = {}) => {
  const errorMessage = error?.message || '';
  const errorCode = error?.code || '';
  const errorName = error?.name || '';
  const contextKey = context?.operation || context?.function || '';

  // Create a key based on error signature (not full stack trace)
  return `${errorName}:${errorCode}:${errorMessage.substring(0, 100)}:${contextKey}`;
};

/**
 * Check if we should send this log based on rate limiting
 */
const shouldSendLog = (errorKey, level) => {
  const now = Date.now();

  // Check rate limit
  const rateLimitKey = `${errorKey}:${level}`;
  const rateLimitEntry = rateLimitCache.get(rateLimitKey);

  if (rateLimitEntry) {
    const { count, resetTime } = rateLimitEntry;

    if (now < resetTime) {
      // Still within rate limit window
      if (count >= LOGGING_CONFIG.MAX_LOGS_PER_MINUTE) {
        // Rate limit exceeded
        if (import.meta.env.DEV) {
          logger.debug(`Rate limit exceeded for: ${errorKey}`);
        }
        return false;
      }
      // Increment count
      rateLimitEntry.count++;
    } else {
      // Reset window
      rateLimitCache.set(rateLimitKey, { count: 1, resetTime: now + 60000 });
    }
  } else {
    // First occurrence
    rateLimitCache.set(rateLimitKey, { count: 1, resetTime: now + 60000 });
  }

  // Check deduplication
  const dedupeKey = errorKey;
  const dedupeEntry = logCache.get(dedupeKey);

  if (dedupeEntry && (now - dedupeEntry.timestamp) < LOGGING_CONFIG.DEDUPE_WINDOW_MS) {
    // Duplicate error within dedupe window
    dedupeEntry.count++;
    if (import.meta.env.DEV) {
      logger.debug(`Duplicate error suppressed (count: ${dedupeEntry.count}): ${errorKey}`);
    }
    return false;
  }

  // New error or outside dedupe window
  logCache.set(dedupeKey, { timestamp: now, count: 1 });

  // Clean up old cache entries (prevent memory leak)
  if (logCache.size > 1000) {
    const cutoff = now - LOGGING_CONFIG.DEDUPE_WINDOW_MS * 2;
    for (const [key, value] of logCache.entries()) {
      if (value.timestamp < cutoff) {
        logCache.delete(key);
      }
    }
  }

  return true;
};

/**
 * List of error codes that are expected/common and should NOT be logged to Cloud Logging
 * These are user-facing errors that don't indicate system problems
 */
const EXPECTED_ERROR_CODES = [
  // Authentication errors (user input issues)
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-email',
  'auth/weak-password',
  'auth/email-already-in-use',
  'auth/invalid-credential',
  'auth/requires-recent-login',

  // Permission errors (expected behavior)
  'permission-denied',
  'not-found',
  'unauthenticated',

  // User-initiated cancellations
  'cancelled',
  'aborted',

  // Custom expected errors
  'user-deleted',
];

/**
 * Check if error should be filtered out (expected/common error)
 */
const shouldFilterError = (error) => {
  if (!error) return false;

  // Check error code
  if (error.code && EXPECTED_ERROR_CODES.includes(error.code)) {
    return true;
  }

  // Check error message for common patterns
  const message = error.message?.toLowerCase() || '';
  const commonPatterns = [
    'network request failed',
    'failed to fetch',
    'networkerror',
    'cors',
  ];

  // Filter network errors that are likely transient
  if (commonPatterns.some(pattern => message.includes(pattern))) {
    // Only filter if it's not a critical system error
    return !message.includes('critical') && !message.includes('fatal');
  }

  return false;
};

/**
 * Send log entry to Google Cloud Logging via Cloud Function
 * OPTIMIZED: Only sends ERROR and CRITICAL severity logs
 * 
 * @param {string} level - Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
 * @param {string} message - Log message
 * @param {Object} context - Additional context data
 * @param {Error} error - Error object (if logging an error)
 */
export const sendCloudLog = async (level, message, context = {}, error = null) => {
  // COST OPTIMIZATION: Only send ERROR and CRITICAL to Cloud Logging
  if (!LOGGING_CONFIG.SEND_TO_CLOUD.includes(level)) {
    // INFO, WARNING, DEBUG only go to console (not Cloud Logging)
    if (import.meta.env.DEV) {
      logger.debug(`[Cloud Logging Skipped] ${level}: ${message}`);
    }
    return;
  }

  // Check if Cloud Logging is enabled
  if (!LOGGING_CONFIG.ENABLED) {
    if (import.meta.env.DEV) {
      logger.debug('Cloud Logging is disabled');
    }
    return;
  }

  // Filter out expected/common errors
  if (error && shouldFilterError(error)) {
    if (import.meta.env.DEV) {
      logger.debug(`[Filtered Expected Error] ${error.code || error.message}`);
    }
    return;
  }

  // Rate limiting and deduplication
  const errorKey = error ? getErrorKey(error, context) : `log:${message.substring(0, 50)}`;
  if (!shouldSendLog(errorKey, level)) {
    return; // Suppressed due to rate limit or deduplication
  }

  // Get Cloud Function URL from environment (if configured)
  const loggingFunctionUrl = import.meta.env.REACT_APP_CLOUD_LOGGING_FUNCTION_URL ||
    import.meta.env.REACT_APP_FUNCTIONS_URL?.replace('resetUserPassword', 'logToCloudLogging') ||
    'https://asia-southeast1-' + (import.meta.env.REACT_APP_FIREBASE_PROJECT_ID || 'YOUR_PROJECT') + '.cloudfunctions.net/logToCloudLogging';

  if (!import.meta.env.REACT_APP_CLOUD_LOGGING_FUNCTION_URL &&
    !import.meta.env.REACT_APP_FUNCTIONS_URL &&
    !import.meta.env.REACT_APP_FIREBASE_PROJECT_ID) {
    // If Cloud Function not configured, just log locally
    if (import.meta.env.DEV) {
      logger.warn('Cloud Logging: Function URL not configured. Set REACT_APP_CLOUD_LOGGING_FUNCTION_URL');
    }
    return;
  }

  try {
    // Prepare log entry in Cloud Logging format
    const logEntry = {
      severity: level,
      message,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        environment: import.meta.env.MODE,
      },
    };

    // Add error details if provided (limit stack trace size to reduce costs)
    if (error) {
      const stackTrace = error.stack || '';
      logEntry.error = {
        name: error.name,
        message: error.message,
        // Limit stack trace to first 50 lines to reduce log size
        stack: stackTrace.split('\n').slice(0, 50).join('\n'),
        code: error.code,
      };
    }

    // Send to Cloud Function (which forwards to Cloud Logging)
    // Use a timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced to 3 seconds

    try {
      const response = await fetch(loggingFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Don't log warnings for network errors to avoid recursion
        if (import.meta.env.DEV) {
          logger.debug('Failed to send log to Cloud Logging:', response.statusText);
        }
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      // Silently fail - don't log errors about logging failures
      // This prevents infinite loops if the logging function is down
      if (import.meta.env.DEV && fetchError.name !== 'AbortError') {
        logger.debug('Error sending log to Cloud Logging:', fetchError.message);
      }
    }
  } catch (err) {
    // Don't fail the app if logging fails
    if (import.meta.env.DEV) {
      logger.warn('Error sending log to Cloud Logging:', err.message);
    }
  }
};

/**
 * Log an error to Cloud Logging
 * Errors are automatically picked up by Error Reporting
 * OPTIMIZED: Only sends if not filtered and passes rate limiting
 * 
 * @param {Error} error - The error to log
 * @param {Object} context - Additional context (user info, operation, etc.)
 */
export const logError = async (error, context = {}) => {
  if (!error) return;

  const errorMessage = error.message || 'Unknown error';

  // Always log to console first
  logger.error('Error occurred:', error, context);

  // Send to Cloud Logging (which feeds Error Reporting)
  // This will be filtered and rate-limited by sendCloudLog
  await sendCloudLog(LOG_LEVELS.ERROR, errorMessage, context, error);
};

/**
 * Log an info message to Cloud Logging
 * OPTIMIZED: Only logs to console, NOT to Cloud Logging (cost optimization)
 * 
 * @param {string} message - Info message
 * @param {Object} context - Additional context
 */
export const logInfo = async (message, context = {}) => {
  logger.info(message, context);
  // COST OPTIMIZATION: INFO logs don't go to Cloud Logging
  // Only ERROR and CRITICAL are sent to reduce costs
};

/**
 * Log a warning to Cloud Logging
 * OPTIMIZED: Only logs to console, NOT to Cloud Logging (cost optimization)
 * 
 * @param {string} message - Warning message
 * @param {Object} context - Additional context
 */
export const logWarning = async (message, context = {}) => {
  logger.warn(message, context);
  // COST OPTIMIZATION: WARNING logs don't go to Cloud Logging
  // Only ERROR and CRITICAL are sent to reduce costs
};

/**
 * Log a debug message to Cloud Logging (only in development)
 * OPTIMIZED: Never sent to Cloud Logging (console only)
 * 
 * @param {string} message - Debug message
 * @param {Object} context - Additional context
 */
export const logDebug = async (message, context = {}) => {
  logger.debug(message, context);
  // COST OPTIMIZATION: DEBUG logs never go to Cloud Logging
  // Only for local development console
};

/**
 * Log a critical error (highest severity)
 * Always sent to Cloud Logging (unless filtered)
 * 
 * @param {Error} error - Critical error
 * @param {Object} context - Additional context
 */
export const logCritical = async (error, context = {}) => {
  if (!error) return;

  const errorMessage = error.message || 'Critical error occurred';

  logger.error('CRITICAL:', error, context);
  await sendCloudLog(LOG_LEVELS.CRITICAL, errorMessage, context, error);
};

export default {
  logError,
  logInfo,
  logWarning,
  logDebug,
  logCritical,
  LOG_LEVELS,
};
