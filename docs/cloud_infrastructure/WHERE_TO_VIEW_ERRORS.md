# 📍 Where to View Error Logging & Monitoring

## Quick Answer

Your errors are logged and monitored using **100% native Google Cloud services**. Here's where to find them:

---

## 🎯 **Primary Location: Cloud Logging Console**

### **URL**: 
```
https://console.cloud.google.com/logs
```
Or with your project:
```
https://console.cloud.google.com/logs?project=YOUR_PROJECT_ID
```

### **What You'll See**:
- ✅ All log entries from your application
- ✅ Error messages with full stack traces
- ✅ Context information (user, operation, timestamp)
- ✅ Searchable and filterable
- ✅ Real-time updates

### **How to Access**:
1. Go to https://console.cloud.google.com
2. Select your Firebase/Google Cloud project
3. In the left sidebar, click **"Logging"** → **"Logs Explorer"**
4. Filter logs by:
   - **Severity**: `ERROR` or `CRITICAL` (for errors)
   - **Resource**: `cloud_function`
   - **Function**: `logToCloudLogging` (for client logs)

---

## 🎯 **Secondary Location: Error Reporting Console**

### **URL**:
```
https://console.cloud.google.com/errors
```
Or with your project:
```
https://console.cloud.google.com/errors?project=YOUR_PROJECT_ID
```

### **What You'll See**:
- ✅ **Errors automatically grouped** by similarity
- ✅ **Error frequency graphs** (how often errors occur)
- ✅ **Affected users count**
- ✅ **Error trends** over time
- ✅ **Error details** with stack traces
- ✅ **First seen / Last seen** timestamps

### **How to Access**:
1. Go to https://console.cloud.google.com
2. Select your Firebase/Google Cloud project
3. In the left sidebar, click **"Error Reporting"**
4. Errors appear automatically (no setup needed!)

**Note**: Error Reporting **automatically detects errors** from Cloud Logging. You don't need to configure anything - just deploy the Cloud Function and errors will appear here!

---

## 🎯 **Development: Browser Console**

### **How to Access**:
1. Open your app in browser
2. Press **F12** (or `Cmd+Option+I` on Mac)
3. Click the **Console** tab

### **What You'll See**:
- ✅ Debug logs (development only)
- ✅ Error messages (always shown)
- ✅ Real-time error logging
- ✅ Warning messages

**Note**: In production builds, debug logs are automatically removed.

---

## 📊 **Additional: Cloud Monitoring** (Optional)

### **URL**:
```
https://console.cloud.google.com/monitoring
```

### **What You'll See**:
- Performance metrics
- Error rate graphs
- Custom dashboards
- Alerting configuration

---

## 🔍 **Step-by-Step: Finding Your Errors**

### **Step 1: Open Cloud Console**
```
https://console.cloud.google.com
```

### **Step 2: Select Your Project**
Click on the project dropdown at the top and select your Firebase project

### **Step 3: Navigate to Logs or Errors**

**For detailed logs**:
- Click **"Logging"** in left sidebar
- Click **"Logs Explorer"**
- Filter by `severity="ERROR"`

**For aggregated errors**:
- Click **"Error Reporting"** in left sidebar
- Errors are automatically displayed

---

## 🔍 **Filtering Logs in Cloud Logging**

### **View Only Errors**:
```
severity="ERROR" OR severity="CRITICAL"
```

### **View Logs from Your App**:
```
resource.type="cloud_function"
resource.labels.function_name="logToCloudLogging"
```

### **View Recent Errors (Last 24 hours)**:
```
severity="ERROR"
timestamp>="2024-01-15T00:00:00Z"
```

### **Combine Filters**:
```
severity="ERROR"
resource.labels.function_name="logToCloudLogging"
timestamp>="2024-01-15T00:00:00Z"
```

---

## 📋 **Direct Links** (Replace YOUR_PROJECT_ID)

Replace `YOUR_PROJECT_ID` with your Firebase project ID:

- **Cloud Logging**: https://console.cloud.google.com/logs?project=YOUR_PROJECT_ID
- **Error Reporting**: https://console.cloud.google.com/errors?project=YOUR_PROJECT_ID
- **Cloud Monitoring**: https://console.cloud.google.com/monitoring?project=YOUR_PROJECT_ID
- **Cloud Functions**: https://console.cloud.google.com/functions?project=YOUR_PROJECT_ID

---

## ✅ **Setup Status**

### **What's Ready**:
- ✅ Cloud Logging utility created
- ✅ Cloud Function code ready
- ✅ Error handler integrated
- ✅ ErrorBoundary integrated
- ✅ All code updated

### **What You Need to Do**:

1. **Deploy Cloud Function**:
   ```bash
   firebase deploy --only functions:logToCloudLogging
   ```

2. **Add to .env**:
   ```bash
   REACT_APP_CLOUD_LOGGING_FUNCTION_URL=https://asia-southeast1-YOUR_PROJECT_ID.cloudfunctions.net/logToCloudLogging
   ```

3. **Restart app**:
   ```bash
   npm start
   ```

4. **View errors**: Go to https://console.cloud.google.com/errors

---

## 🧪 **Quick Test**

After setup, test with:

```javascript
import { logError } from './utils/gcp-logging';
logError(new Error('Test error'));
```

Then check:
- Cloud Logging: https://console.cloud.google.com/logs (within seconds)
- Error Reporting: https://console.cloud.google.com/errors (within 1-2 minutes)

---

## 📚 **More Information**

- **Complete Setup Guide**: See `GOOGLE_CLOUD_ERROR_MONITORING_SETUP.md`
- **Quick Start**: See `GOOGLE_CLOUD_SETUP_QUICK_START.md`
- **Detailed Guide**: See `GOOGLE_CLOUD_ERROR_MONITORING.md`

---

**All services are native Google Cloud Platform** - no third-party services! ✅

**Last Updated**: 2024-01-15
