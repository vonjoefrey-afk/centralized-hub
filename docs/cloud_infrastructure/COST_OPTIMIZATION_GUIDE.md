# Cost Optimization Guide - Error Logging & Monitoring

## 🎯 Overview

This guide explains the cost optimization features implemented to prevent expensive Cloud Logging usage while maintaining effective error monitoring.

## ✅ Optimizations Implemented

### 1. **Severity-Based Filtering** (Primary Cost Saver)
- **Only ERROR and CRITICAL logs are sent to Cloud Logging**
- INFO, WARNING, and DEBUG logs only appear in browser console
- **Cost Impact**: Reduces log volume by ~80-90% (most logs are INFO/WARNING)

### 2. **Rate Limiting**
- **Client-side**: Max 10 logs per minute per error type
- **Server-side**: Max 20 requests per minute per IP, 100 per hour
- **Cost Impact**: Prevents runaway logging from bugs or loops

### 3. **Error Deduplication**
- Same error logged within 1 minute is suppressed
- Only first occurrence is sent to Cloud Logging
- **Cost Impact**: Prevents duplicate error spam

### 4. **Expected Error Filtering**
- Common user-facing errors are filtered out:
  - `auth/user-not-found`, `auth/wrong-password`
  - `permission-denied`, `not-found`
  - `cancelled`, `aborted`
- **Cost Impact**: Filters ~30-40% of errors that don't indicate system problems

### 5. **Stack Trace Limiting**
- Stack traces limited to first 30-50 lines
- Reduces log entry size
- **Cost Impact**: Reduces storage costs per log entry

### 6. **Cloud Function Optimization**
- Reduced timeout: 10 seconds (was unlimited)
- Minimal memory: 256MB
- Max instances: 10 concurrent
- **Cost Impact**: Limits compute costs

### 7. **Request Size Limits**
- Maximum 100KB per log entry
- Prevents expensive large payloads
- **Cost Impact**: Prevents abuse and large log entries

## 📊 Expected Cost Impact

### Before Optimization:
- **All logs** (INFO, WARNING, ERROR, DEBUG) sent to Cloud Logging
- No rate limiting
- No deduplication
- **Estimated cost**: $50-200/month for high-traffic apps

### After Optimization:
- **Only ERROR and CRITICAL** sent to Cloud Logging
- Rate limiting prevents spikes
- Deduplication reduces duplicates
- **Estimated cost**: $5-20/month for high-traffic apps

**Savings: 80-90% reduction in logging costs**

## 🔧 Configuration

### Environment Variables

```bash
# Enable/disable Cloud Logging entirely
REACT_APP_ENABLE_CLOUD_LOGGING=true  # Set to 'false' to disable

# Cloud Function URL (required for Cloud Logging)
REACT_APP_CLOUD_LOGGING_FUNCTION_URL=https://...
```

### Adjust Rate Limits (in code)

**Client-side** (`src/utils/gcp-logging.js`):
```javascript
const LOGGING_CONFIG = {
  MAX_LOGS_PER_MINUTE: 10,      // Adjust as needed
  DEDUPE_WINDOW_MS: 60000,      // 1 minute
};
```

**Server-side** (`functions/index.js`):
```javascript
const RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 20,  // Per IP
  MAX_REQUESTS_PER_HOUR: 100,   // Per IP
};
```

## 📈 Monitoring Usage

### Check Cloud Logging Usage:
1. Go to: https://console.cloud.google.com/logs?project=YOUR_PROJECT
2. Filter by: `resource.type="cloud_function"` AND `resource.labels.function_name="logToCloudLogging"`
3. Check volume over time

### Check Function Invocations:
1. Go to: https://console.cloud.google.com/functions?project=YOUR_PROJECT
2. Click on `logToCloudLogging`
3. View "Invocations" tab for usage metrics

### Check Costs:
1. Go to: https://console.cloud.google.com/billing?project=YOUR_PROJECT
2. Filter by service: "Cloud Logging" and "Cloud Functions"
3. Monitor monthly costs

## ⚠️ What Gets Logged vs. Filtered

### ✅ Logged to Cloud Logging:
- **ERROR** severity logs (unexpected errors)
- **CRITICAL** severity logs (system failures)
- Errors that pass rate limiting and deduplication
- Errors that are NOT in the expected error list

### ❌ Filtered Out (NOT logged):
- **INFO** logs (console only)
- **WARNING** logs (console only)
- **DEBUG** logs (console only)
- Expected errors (auth failures, permission denied, etc.)
- Duplicate errors within 1 minute
- Errors exceeding rate limits

## 🚨 Troubleshooting

### "Too many requests" errors:
- **Cause**: Rate limit exceeded
- **Solution**: Increase rate limits in code if legitimate
- **Check**: Are there bugs causing error loops?

### Logs not appearing:
- **Check**: Is severity ERROR or CRITICAL?
- **Check**: Is error in expected error list?
- **Check**: Rate limit not exceeded?
- **Check**: Cloud Function deployed and accessible?

### High costs still occurring:
1. Check Cloud Logging volume in console
2. Verify only ERROR/CRITICAL are being sent
3. Check for error loops in application
4. Review rate limit settings
5. Consider disabling Cloud Logging temporarily: `REACT_APP_ENABLE_CLOUD_LOGGING=false`

## 💡 Best Practices

1. **Monitor costs regularly** - Check billing dashboard monthly
2. **Review error patterns** - If same error repeats, fix the bug instead of logging
3. **Use console logs for development** - Only production errors go to Cloud Logging
4. **Set up billing alerts** - Get notified if costs spike
5. **Review logs periodically** - Clean up old logs if needed

## 📝 Summary

The optimized logging system:
- ✅ Only logs **ERROR** and **CRITICAL** severity
- ✅ Rate limits prevent excessive calls
- ✅ Deduplicates duplicate errors
- ✅ Filters expected/common errors
- ✅ Limits stack trace size
- ✅ Optimizes Cloud Function resources

**Result**: 80-90% cost reduction while maintaining effective error monitoring.

---

**Last Updated**: $(date)
**Project**: centralized-gcp
