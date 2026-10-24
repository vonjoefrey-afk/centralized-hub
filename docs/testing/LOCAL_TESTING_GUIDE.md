# Local Environment Testing Guide

## ✅ Status: React App Running on http://localhost:3000

### Pre-Testing Checklist
- ✅ All ports cleared
- ✅ Cloud Function deployed and tested
- ✅ Environment variable added to `.env`
- ✅ React app started successfully
- ✅ No linting errors

## 🧪 Testing Steps

### Step 1: Verify App Loads
1. Open browser: http://localhost:3000
2. Check browser console (F12 → Console tab) for any errors
3. Expected: No errors related to Cloud Logging or environment variables

### Step 2: Test Error Logging in Browser Console

Open browser DevTools Console (F12) and run:

```javascript
// Test 1: Import and test logError function
// Note: In React app, this is already imported via errorHandler
// This simulates what happens when an error occurs

// Test sending a log entry directly
fetch('https://asia-southeast1-centralized-gcp.cloudfunctions.net/logToCloudLogging', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    severity: 'ERROR',
    message: 'Test error from local environment',
    context: {
      test: true,
      timestamp: new Date().toISOString(),
      environment: 'development',
      source: 'browser-console-test'
    }
  })
})
.then(r => r.json())
.then(data => console.log('✅ Log sent successfully:', data))
.catch(err => console.error('❌ Failed to send log:', err));
```

### Step 3: Trigger Real Error in App

**Option A: Trigger Authentication Error**
1. Try logging in with invalid credentials
2. Check browser console - should see error logged
3. Check Cloud Logging (see Step 4) - error should appear

**Option B: Trigger Firestore Permission Error**
1. Try accessing data you don't have permission for
2. Check browser console for error
3. Verify it's sent to Cloud Logging

### Step 4: Verify Logs in Cloud Console

**Cloud Logging Console:**
https://console.cloud.google.com/logs?project=centralized-gcp

**Filter Query:**
```
resource.type="cloud_function"
resource.labels.function_name="logToCloudLogging"
severity>=ERROR
```

**Or search for your test message:**
```
"Test error from local environment"
```

**Error Reporting Console:**
https://console.cloud.google.com/errors?project=centralized-gcp

**Expected:**
- Logs appear within 1-2 minutes
- ERROR and CRITICAL severity logs are automatically aggregated
- Stack traces and context are preserved

### Step 5: Test Error Boundary

1. Trigger a React component error (if possible)
2. Verify ErrorBoundary catches it
3. Check that error is logged to Cloud Logging

### Step 6: Test Development vs Production Behavior

**Development (current):**
- Logs also appear in browser console
- Verbose logging enabled
- Cloud Function URL from `.env`

**Production (after build):**
- Only critical errors in console
- All logs sent to Cloud Logging
- Error Reporting aggregates errors automatically

## 🐛 Troubleshooting

### App won't start?
```bash
# Check for errors
npm start

# Verify environment variables
cat .env | grep CLOUD_LOGGING
```

### Logs not appearing in Cloud Logging?
1. Check `.env` file has correct URL
2. Verify Cloud Function is deployed:
   ```bash
   firebase functions:list
   ```
3. Test function directly:
   ```bash
   curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/logToCloudLogging \
     -H "Content-Type: application/json" \
     -d '{"severity":"INFO","message":"Test"}'
   ```

### CORS Errors?
- Cloud Function should have CORS enabled (already configured)
- Check browser console for CORS error messages

### Environment Variable Not Loading?
- Restart React dev server after adding to `.env`
- Variables must start with `REACT_APP_`
- Check `.env` file is in project root

## ✅ Success Criteria

Before deploying to production, verify:

- [ ] App starts without errors
- [ ] Test log successfully sent from browser console
- [ ] Log appears in Cloud Logging console within 2 minutes
- [ ] Error Reporting shows the log (for ERROR/CRITICAL severity)
- [ ] Real app errors are logged automatically
- [ ] No console errors related to logging
- [ ] Error Boundary works correctly

## 📊 Expected Results

**Browser Console (Development):**
```
Sending to Cloud Logging: { level: 'ERROR', message: '...', context: {...} }
```

**Cloud Logging Console:**
- Structured log entry with severity, message, context
- Timestamp included
- Environment marked as "development"

**Error Reporting Console:**
- Errors grouped by similarity
- Frequency statistics
- Stack traces preserved

---

**Testing Date:** $(date)
**App URL:** http://localhost:3000
**Function URL:** https://asia-southeast1-centralized-gcp.cloudfunctions.net/logToCloudLogging
