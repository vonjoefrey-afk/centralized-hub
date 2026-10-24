# 📊 Google Cloud Error Logging & Monitoring Setup

## Overview

This application uses **native Google Cloud services** for error logging and monitoring:

1. **Cloud Logging** - Centralized log management
2. **Error Reporting** - Automatic error detection and aggregation  
3. **Cloud Monitoring** - Performance metrics and dashboards
4. **Cloud Functions** - Server-side log processing

**All services are part of Google Cloud Platform** - no third-party services required.

---

## 📍 Where to See Errors

### 1. **Cloud Logging Console** (Primary)
**URL**: https://console.cloud.google.com/logs

**How to Access**:
1. Go to https://console.cloud.google.com
2. Select your Firebase project
3. Navigate to **Logging** → **Logs Explorer** (or use direct URL above)
4. Filter by:
   - Resource type: `cloud_function`
   - Function name: `logToCloudLogging` (for client logs)
   - Severity: `ERROR` or `CRITICAL` (for errors)

**What You'll See**:
- ✅ All log entries from your application
- ✅ Error stack traces
- ✅ Contextual information (user, operation, etc.)
- ✅ Timestamps and severity levels
- ✅ Searchable and filterable logs

### 2. **Error Reporting Console** (Automatic Aggregation)
**URL**: https://console.cloud.google.com/errors

**How to Access**:
1. Go to https://console.cloud.google.com
2. Select your Firebase project
3. Navigate to **Error Reporting** (or use direct URL above)

**What You'll See**:
- ✅ **Automatically grouped errors** (similar errors aggregated)
- ✅ **Error frequency and trends**
- ✅ **Affected user count**
- ✅ **First seen / Last seen** timestamps
- ✅ **Error details** with stack traces
- ✅ **Error occurrence timeline**

**Note**: Error Reporting automatically detects errors from Cloud Logging - no additional setup needed!

### 3. **Cloud Monitoring** (Metrics & Dashboards)
**URL**: https://console.cloud.google.com/monitoring

**How to Access**:
1. Go to https://console.cloud.google.com
2. Select your Firebase project
3. Navigate to **Monitoring** → **Dashboards**

**What You'll See**:
- ✅ **Error rate metrics**
- ✅ **Application performance**
- ✅ **Custom dashboards**
- ✅ **Alerting** (email/Slack notifications)

### 4. **Cloud Functions Logs** (Server-side)
**URL**: https://console.cloud.google.com/functions/list

**How to Access**:
1. Go to https://console.cloud.google.com
2. Select your Firebase project
3. Navigate to **Cloud Functions**
4. Click on a function → **Logs** tab

**What You'll See**:
- ✅ **Function execution logs**
- ✅ **Error logs from functions**
- ✅ **Performance metrics**

### 5. **Browser Console** (Development)
**Location**: Press `F12` → **Console** tab

**What You'll See**:
- ✅ **Debug logs** (development only)
- ✅ **Error messages** (always shown)
- ✅ **Real-time error logging**

---

## 🚀 Setup Instructions

### Step 1: Deploy Cloud Functions (Required)

The `logToCloudLogging` function needs to be deployed:

```bash
cd functions
npm install  # Install @google-cloud/logging package
cd ..
firebase deploy --only functions:logToCloudLogging
```

This will create an endpoint like:
```
https://asia-southeast1-YOUR_PROJECT.cloudfunctions.net/logToCloudLogging
```

### Step 2: Configure Environment Variables

Add to your `.env` file:

```bash
# Option 1: Full URL (recommended)
REACT_APP_CLOUD_LOGGING_FUNCTION_URL=https://asia-southeast1-YOUR_PROJECT.cloudfunctions.net/logToCloudLogging

# Option 2: Just project ID (will auto-construct URL)
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
```

### Step 3: Enable Error Reporting (Automatic)

Error Reporting is **automatically enabled** once Cloud Logging is set up. No additional configuration needed!

**To verify**:
1. Go to https://console.cloud.google.com/errors
2. Errors will automatically appear after they're logged

### Step 4: Test the Setup

**Test Logging**:
```javascript
import { logError } from './utils/gcp-logging';

// Test error logging
logError(new Error('Test error for Cloud Logging'), {
  test: true,
  section: 'setup-verification'
});
```

**Then check**:
1. Cloud Logging: https://console.cloud.google.com/logs
2. Error Reporting: https://console.cloud.google.com/errors
3. The test error should appear within a few seconds

---

## 🔧 How It Works

### Architecture Flow:

```
React App (Client)
    ↓
Error occurs / logError() called
    ↓
gcp-logging.js utility
    ↓
HTTP POST to Cloud Function (logToCloudLogging)
    ↓
Cloud Function writes to Cloud Logging
    ↓
Cloud Logging
    ├─→ Error Reporting (auto-detects errors)
    ├─→ Cloud Monitoring (metrics)
    └─→ Logs Explorer (view/search logs)
```

### What Gets Logged:

✅ **Automatically Logged**:
- React component errors (via ErrorBoundary)
- Unexpected Firestore/Firebase errors
- Errors from `logError()` calls
- Critical application errors

❌ **NOT Logged** (filtered out):
- Common user errors (permission-denied, not-found)
- Expected authentication errors
- Sensitive data (passwords, tokens)

---

## 📋 Quick Reference

### View Logs
- **Cloud Logging**: https://console.cloud.google.com/logs?project=YOUR_PROJECT
- **Error Reporting**: https://console.cloud.google.com/errors?project=YOUR_PROJECT
- **Cloud Monitoring**: https://console.cloud.google.com/monitoring?project=YOUR_PROJECT

### Filter Logs in Cloud Logging
Use the query builder or Logs Query Language:
```
resource.type="cloud_function"
resource.labels.function_name="logToCloudLogging"
severity>=ERROR
```

### Manual Error Logging
```javascript
import { logError, logInfo, logWarning } from './utils/gcp-logging';

// Log an error
logError(new Error('Something went wrong'), {
  userId: user.uid,
  operation: 'createUpdate',
  context: 'team-management'
});

// Log info
logInfo('User action completed', { action: 'login' });

// Log warning
logWarning('Performance degradation detected', { metric: 'load-time' });
```

---

## 🎯 Features

### Automatic Error Detection
- Errors are **automatically detected** by Error Reporting
- **No manual setup** required for error detection
- **Grouped by similarity** (duplicate errors aggregated)

### Searchable Logs
- **Full-text search** in Cloud Logging
- **Filter by** severity, timestamp, function, etc.
- **Export logs** for analysis

### Error Aggregation
- **Similar errors grouped** together
- **Frequency tracking** (how often errors occur)
- **Trend analysis** (error rate over time)

### User Context
- **User information** included in logs (when available)
- **Operation context** (what was being done)
- **Browser/device info** (for debugging)

### Security
- **Sensitive data filtered** automatically
- **Passwords/tokens** never logged
- **Compliant** with Google Cloud security standards

---

## 🔒 Privacy & Security

### What is Logged:
✅ Error messages and stack traces
✅ User ID (not full user object)
✅ Operation context
✅ Timestamp and environment

### What is NOT Logged:
❌ Passwords
❌ Authentication tokens
❌ Full user objects
❌ Sensitive request data

---

## 📊 Monitoring & Alerts

### Set Up Alerts

1. Go to https://console.cloud.google.com/monitoring/alerting
2. Create alert policy
3. Set conditions:
   - **Metric**: Error rate
   - **Threshold**: e.g., > 10 errors/hour
4. Configure notifications:
   - Email
   - Slack (via webhook)
   - PagerDuty
   - SMS

### Create Dashboards

1. Go to https://console.cloud.google.com/monitoring/dashboards
2. Create custom dashboard
3. Add widgets:
   - Error rate graph
   - Error count by type
   - Function performance
   - User activity

---

## 🧪 Testing

### Test Error Logging

```javascript
// In any component
import { logError } from '../utils/gcp-logging';

// Trigger a test error
logError(new Error('Test error - verifying Cloud Logging setup'), {
  test: true,
  timestamp: new Date().toISOString()
});
```

### Verify in Console

1. **Cloud Logging**: 
   - Go to https://console.cloud.google.com/logs
   - Filter: `severity="ERROR"` and `jsonPayload.test=true`
   - Should see your test error

2. **Error Reporting**:
   - Go to https://console.cloud.google.com/errors
   - Should see "Test error - verifying Cloud Logging setup"
   - Errors appear within 1-2 minutes

---

## 🐛 Troubleshooting

### Issue: No logs appearing in Cloud Logging

**Solutions**:
1. Verify Cloud Function is deployed:
   ```bash
   firebase functions:list
   # Should see logToCloudLogging function
   ```

2. Check function URL in `.env`:
   ```bash
   REACT_APP_CLOUD_LOGGING_FUNCTION_URL=https://asia-southeast1-YOUR_PROJECT.cloudfunctions.net/logToCloudLogging
   ```

3. Test function directly:
   ```bash
   curl -X POST https://asia-southeast1-YOUR_PROJECT.cloudfunctions.net/logToCloudLogging \
     -H "Content-Type: application/json" \
     -d '{"severity":"ERROR","message":"Test","context":{}}'
   ```

4. Check browser console for errors
5. Check Cloud Function logs:
   ```bash
   firebase functions:log --only logToCloudLogging
   ```

### Issue: Errors not appearing in Error Reporting

**Solutions**:
1. Wait 1-2 minutes (Error Reporting has a delay)
2. Verify errors are being logged to Cloud Logging first
3. Check Error Reporting is enabled:
   - Go to https://console.cloud.google.com/errors
   - Should see "Error Reporting is active" message
4. Ensure errors have `severity="ERROR"` or `severity="CRITICAL"`

### Issue: Function deployment fails

**Solutions**:
1. Install dependencies in functions folder:
   ```bash
   cd functions
   npm install
   ```

2. Check Node.js version (should be 20):
   ```bash
   node --version
   ```

3. Verify billing is enabled for GCP project
4. Check IAM permissions for Cloud Functions

---

## 📚 Additional Resources

- **Cloud Logging Docs**: https://cloud.google.com/logging/docs
- **Error Reporting Docs**: https://cloud.google.com/error-reporting/docs
- **Cloud Monitoring Docs**: https://cloud.google.com/monitoring/docs
- **Cloud Functions Docs**: https://cloud.google.com/functions/docs

---

## ✅ Setup Checklist

- [ ] Deploy `logToCloudLogging` Cloud Function
- [ ] Add `REACT_APP_CLOUD_LOGGING_FUNCTION_URL` to `.env`
- [ ] Test error logging from React app
- [ ] Verify logs appear in Cloud Logging console
- [ ] Verify errors appear in Error Reporting console
- [ ] Set up alerts (optional)
- [ ] Create monitoring dashboards (optional)

---

**Last Updated**: 2024-01-15  
**Services Used**: Google Cloud Logging, Error Reporting, Cloud Functions (all native GCP)
