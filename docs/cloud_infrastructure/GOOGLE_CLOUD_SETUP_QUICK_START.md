# ⚡ Quick Start: Google Cloud Error Monitoring

## 🎯 Where to See Your Errors

### **Cloud Logging Console** (Main Logs)
**URL**: https://console.cloud.google.com/logs

- All logs from your app
- Searchable and filterable
- Real-time updates

### **Error Reporting** (Automatic Error Aggregation)
**URL**: https://console.cloud.google.com/errors

- Errors automatically grouped
- Error frequency and trends
- **No setup needed** - automatically detects errors from Cloud Logging!

### **Cloud Monitoring** (Metrics & Dashboards)
**URL**: https://console.cloud.google.com/monitoring

- Performance metrics
- Custom dashboards
- Alerting

---

## 🚀 3-Step Setup

### Step 1: Deploy Cloud Function (2 minutes)

```bash
cd functions
npm install
cd ..
firebase deploy --only functions:logToCloudLogging
```

This creates the endpoint that forwards logs to Cloud Logging.

### Step 2: Add to .env (30 seconds)

Add to your `.env` file:
```bash
REACT_APP_CLOUD_LOGGING_FUNCTION_URL=https://asia-southeast1-YOUR_PROJECT_ID.cloudfunctions.net/logToCloudLogging
```

Replace `YOUR_PROJECT_ID` with your Firebase project ID.

### Step 3: Restart App (30 seconds)

```bash
npm start
```

**Done!** ✅

---

## ✅ Verify It's Working

1. **Test error logging**:
   ```javascript
   import { logError } from './utils/gcp-logging';
   logError(new Error('Test error'));
   ```

2. **Check Cloud Logging** (within seconds):
   - Go to: https://console.cloud.google.com/logs
   - Filter: `severity="ERROR"`
   - You should see your test error

3. **Check Error Reporting** (within 1-2 minutes):
   - Go to: https://console.cloud.google.com/errors
   - Your error should appear automatically

---

## 📍 Direct Links (Replace YOUR_PROJECT_ID)

- **Logs**: https://console.cloud.google.com/logs?project=YOUR_PROJECT_ID
- **Errors**: https://console.cloud.google.com/errors?project=YOUR_PROJECT_ID
- **Monitoring**: https://console.cloud.google.com/monitoring?project=YOUR_PROJECT_ID
- **Functions**: https://console.cloud.google.com/functions?project=YOUR_PROJECT_ID

---

**All services are native Google Cloud - no third-party services!** ✅
