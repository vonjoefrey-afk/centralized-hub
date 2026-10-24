

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  WINDOW_MS: 60 * 60 * 1000, // 1 hour
  MAX_REQUESTS_PER_HOUR: 100, // Per IP address
};

// In-memory store for rate limiting (Note: This is per-instance, not global)
// Recommendation: Replace with Redis or Firestore for distributed rate limiting
const ipRequestCounts = {};

/**
 * Check rate limit for IP address
 * @param {string} ip - Client IP address
 * @return {Object} Rate limit check result
 */
exports.checkRateLimit = (ip) => {
  const now = Date.now();

  // Clean up old entries
  if (ipRequestCounts[ip]) {
    if (now - ipRequestCounts[ip].startTime > RATE_LIMIT_CONFIG.WINDOW_MS) {
      delete ipRequestCounts[ip];
    }
  }

  // Initialize if not exists
  if (!ipRequestCounts[ip]) {
    ipRequestCounts[ip] = {
      count: 0,
      startTime: now,
    };
  }

  // Increment count
  ipRequestCounts[ip].count++;

  // Check limit
  if (ipRequestCounts[ip].count > RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_HOUR) {
    return {
      allowed: false,
      reason: "Rate limit exceeded. Please try again later.",
    };
  }

  return {allowed: true};
};
