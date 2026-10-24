

/**
 * Helper function to write logs to Cloud Logging
 * Uses structured logging format that Error Reporting can automatically detect
 *
 * @param {string} severity - Log severity level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata to include in log
 * @return {Promise<void>}
 */
exports.writeCloudLog = async (severity, message, metadata = {}) => {
  const logEntry = {
    severity,
    message,
    ...metadata,
    timestamp: new Date().toISOString(),
  };

  // In local development, just print to console
  if (process.env.FUNCTIONS_EMULATOR) {
    if (severity === "ERROR" || severity === "CRITICAL") {
      console.error(`[${severity}] ${message}`, metadata);
    } else {
      console.log(`[${severity}] ${message}`, metadata);
    }
    return;
  }

  // In production, simpler console logging often works for standard extraction,
  // but structured logging is preferred for better querying.
  console.log(JSON.stringify(logEntry));
};
