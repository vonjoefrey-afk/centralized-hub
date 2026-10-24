# Quick Browser Console Test

## Copy & Paste This in Browser Console (F12)

After opening http://localhost:3000, press F12 to open DevTools, then paste this in the Console tab:

```javascript
// Quick Test: Send a test log to Cloud Logging
(async () => {
  console.log('🧪 Testing Cloud Logging...');
  
  try {
    const response = await fetch('https://asia-southeast1-centralized-gcp.cloudfunctions.net/logToCloudLogging', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        severity: 'ERROR',
        message: 'Browser Console Test - ' + new Date().toISOString(),
        context: {
          test: true,
          source: 'browser-console',
          timestamp: new Date().toISOString(),
          environment: 'development',
          userAgent: navigator.userAgent
        }
      })
    });
    
    const result = await response.json();
    console.log('✅ SUCCESS! Log sent:', result);
    console.log('📊 Check Cloud Logging: https://console.cloud.google.com/logs?project=centralized-gcp');
    console.log('⏱️  Logs appear within 1-2 minutes');
  } catch (error) {
    console.error('❌ FAILED:', error);
  }
})();
```

## Test Real Error Logging

To test the actual error logging integration in your app:

```javascript
// This simulates what happens when your app encounters an error
// The errorHandler.js will automatically call logError()

// Example: Trigger a Firebase auth error (if you're logged in)
// Just try logging in with wrong credentials and check console

// Or manually test:
import { logError } from './utils/gcp-logging';
const testError = new Error('Test error from console');
await logError(testError, { test: true, source: 'manual-test' });
```

## Verify Results

1. **Wait 1-2 minutes** for logs to propagate
2. **Open Cloud Logging:** https://console.cloud.google.com/logs?project=centralized-gcp
3. **Filter:** `"Browser Console Test"` or `severity="ERROR"`
4. **Check Error Reporting:** https://console.cloud.google.com/errors?project=centralized-gcp

## Expected Result

✅ Browser console shows: `SUCCESS! Log sent: {success: true, message: "..."}`

✅ Cloud Logging shows: Structured log entry with your test message

✅ Error Reporting shows: Error aggregated (for ERROR/CRITICAL severity)
