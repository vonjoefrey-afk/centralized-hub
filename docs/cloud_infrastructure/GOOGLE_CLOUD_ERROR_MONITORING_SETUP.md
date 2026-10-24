# 📊 Google Cloud Error Monitoring - Complete Setup Guide

## ✅ What's Been Set Up

Your application now uses **100% native Google Cloud services** for error logging and monitoring:

1. ✅ **Cloud Logging** - All logs stored in Google Cloud
2. ✅ **Error Reporting** - Automatic error detection (no setup needed)
3. ✅ **Cloud Monitoring** - Performance metrics and dashboards
4. ✅ **Cloud Functions** - Server-side log processing

**NO third-party services** - everything is in Google Cloud! ✅

---

## 📍 Where to See Your Errors

### **Cloud Logging** (View All Logs)
**URL**: https://console.cloud.google.com/logs

**Steps**:
1. Go to https://console.cloud.google.com
2. Select your Firebase project
3. Navigate to **Logging** → **Logs Explorer**
4. Filter by `severity="ERROR"` to see errors

**What you'll see**:
- All log entries from your app
- Error stack traces
- Context information
- Timestamps and severity levels

### **Error Reporting** (Automatic Error Aggregation)
**URL**: https://console.cloud.google.com/errors

**Steps**:
1. Go to https://console.cloud.google.com
2. Select your Firebase project  
3. Navigate to **Error Reporting**

**What you'll see**:
- Errors automatically grouped by similarity
- Error frequency and trends
- Affected user counts
- Error details with stack traces

**Note**: Error Reporting **automatically detects errors** from Cloud Logging - no setup needed!

### **Cloud Monitoring** (Metrics & Dashboards)
**URL**: https://console.cloud.google.com/monitoring

**Features**:
- Performance metrics
- Custom dashboards
- Alerting (email/Slack notifications)

---

## 🚀 Setup Instructions

### Step 1: Deploy Cloud Function (Required)

Deploy the `logToCloudLogging` function that forwards client logs to Cloud Logging:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions:logToCloudLogging
```

**Expected output**:
```
✔  functions[logToCloudLogging(asia-southeast1)] Successful create operation.
Function URL: https://asia-southeast1-YOUR_PROJECT.cloudfunctions.net/logToCloudLogging
```

### Step 2: Configure Environment Variable

Add to your `.env` file:

```bash
REACT_APP_CLOUD_LOGGING_FUNCTION_URL=https://asia-southeast1-YOUR_PROJECT_ID.cloudfunctions.net/logToCloudLogging
```

Replace `YOUR_PROJECT_ID` with your Firebase project ID.

**Alternative**: If you already have `REACT_APP_FIREBASE_PROJECT_ID` set, the URL will be auto-constructed.

### Step 3: Restart Your App

```bash
npm start
```

### Step 4: Verify Setup

Check browser console for:
```
Cloud Logging: Configure REACT_APP_CLOUD_LOGGING_FUNCTION_URL to enable error tracking
View logs at: https://console.cloud.google.com/logs
View errors at: https://console.cloud.google.com/errors
```

---

## 🧪 Test Error Logging

### Test from React App:

```javascript
import { logError } from './utils/gcp-logging';

// Test error
logError(new Error('Test error for Cloud Logging'), {
  test: true,
  section: 'dashboard'
});
```

### Then Check:

1. **Cloud Logging** (within seconds):
   - Go to: https://console.cloud.google.com/logs
   - Filter: `severity="ERROR"`
   - Should see your test error

2. **Error Reporting** (within 1-2 minutes):
   - Go to: https://console.cloud.google.com/errors
   - Should see "Test error for Cloud Logging"
   - Errors are automatically aggregated

---

## 🔍 How Errors Are Captured

### Automatic Error Capture:

1. **React Component Errors**:
   - Caught by `ErrorBoundary` component
   - Automatically sent to Cloud Logging
   - Appears in Error Reporting

2. **Firestore/Firebase Errors**:
   - Caught by `handleFirestoreError` utility
   - Unexpected errors sent to Cloud Logging
   - Common user errors filtered out

3. **Uncaught JavaScript Errors**:
   - Automatically logged via error handlers
   - Sent to Cloud Logging

### Manual Error Logging:

```javascript
import { logError, logInfo, logWarning } from './utils/gcp-logging';

// Log an error
logError(new Error('Something went wrong'), {
  userId: user.uid,
  operation: 'createUpdate'
});

// Log info
logInfo('User action completed', { action: 'login' });

// Log warning  
logWarning('Performance issue detected', { metric: 'load-time' });
```

---

## 📊 Cloud Logging Query Examples

### Filter Errors Only:
```
severity="ERROR" OR severity="CRITICAL"
```

### Filter by Function:
```
resource.type="cloud_function"
resource.labels.function_name="logToCloudLogging"
```

### Filter by Time:
```
timestamp>="2024-01-15T00:00:00Z"
```

### Combine Filters:
```
severity="ERROR"
resource.labels.function_name="logToCloudLogging"
timestamp>="2024-01-15T00:00:00Z"
```

---

## 🔒 Security & Privacy

### What Gets Logged:
✅ Error messages and stack traces
✅ User ID (for identifying affected users)
✅ Operation context (what was being done)
✅ Browser/device information
✅ Timestamps

### What Does NOT Get Logged:
❌ Passwords (never sent)
❌ Authentication tokens (never sent)
❌ Full user objects (only ID sent)
❌ Sensitive request data (filtered)

---

## 📋 Quick Reference

### View Logs:
- **Cloud Logging**: https://console.cloud.google.com/logs?project=YOUR_PROJECT_ID
- **Error Reporting**: https://console.cloud.google.com/errors?project=YOUR_PROJECT_ID
- **Cloud Monitoring**: https://console.cloud.google.com/monitoring?project=YOUR_PROJECT_ID

### Function URL Pattern:
```
https://asia-southeast1-YOUR_PROJECT_ID.cloudfunctions.net/logToCloudLogging
```

### Environment Variable:
```bash
REACT_APP_CLOUD_LOGGING_FUNCTION_URL=https://asia-southeast1-YOUR_PROJECT_ID.cloudfunctions.net/logToCloudLogging
```

---

## ✅ Setup Checklist

- [ ] Deploy `logToCloudLogging` Cloud Function
- [ ] Add `REACT_APP_CLOUD_LOGGING_FUNCTION_URL` to `.env`
- [ ] Restart application
- [ ] Test error logging
- [ ] Verify logs in Cloud Logging console
- [ ] Verify errors in Error Reporting console

---

**All services are native Google Cloud Platform** - no third-party dependencies! ✅

**Last Updated**: 2024-01-15
