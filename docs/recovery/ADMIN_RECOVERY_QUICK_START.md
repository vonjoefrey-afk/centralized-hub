# 🔐 Admin Recovery - Quick Start Guide

## ⚠️ Critical Problem Solved

**Before**: Single admin account = Single point of failure  
**After**: Multiple recovery mechanisms = Corporate-level resilience

---

## 🚀 Immediate Actions (Do This First!)

### Step 1: Deploy Recovery Functions
```bash
firebase deploy --only functions:emergencyAdminPasswordReset,functions:listAdminAccounts,functions:createBackupAdmin
```

### Step 2: Set Recovery Code
```bash
# Set a secure recovery code (store this securely!)
firebase functions:config:set admin.recovery_code="YOUR_SECURE_CODE_123"

# Or use environment variable
export ADMIN_RECOVERY_CODE="YOUR_SECURE_CODE_123"
```

### Step 3: Create Backup Admin Accounts (CRITICAL!)

**Option A: Using Cloud Function** (Recommended)
```bash
curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/createBackupAdmin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "backup-admin@yourcompany.com",
    "password": "SecurePassword123!",
    "displayName": "Backup Admin",
    "verificationCode": "YOUR_SECURE_CODE_123"
  }'
```

**Option B: Using Script**
```bash
node create-backup-admin.js
```

**Option C: Using Admin Dashboard** (After UI implementation)

---

## 📋 Recommended Admin Account Structure

### Minimum Setup (3 Accounts):
1. **Primary Admin**: `admin@yourcompany.com`
   - Daily operations
   - Main admin account

2. **Backup Admin**: `backup-admin@yourcompany.com`
   - Emergency recovery
   - Secondary admin

3. **Super Admin**: `super-admin@yourcompany.com`
   - Last resort recovery
   - Store password in secure vault

### Best Practice:
- **Different emails** for each admin
- **Different passwords** (strong, unique)
- **Store credentials** in company password manager
- **Document** in company security procedures

---

## 🔧 Emergency Recovery Procedures

### If Admin Forgot Password (Other Admins Available):

**Option 1: Use Another Admin Account**
1. Log in with backup admin
2. Go to Admin Dashboard
3. Reset password for locked admin

**Option 2: Use Cloud Function**
```bash
curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/emergencyAdminPasswordReset \
  -H "Content-Type: application/json" \
  -d '{
    "adminEmail": "locked-admin@yourcompany.com",
    "newPassword": "NewPassword123!",
    "verificationCode": "YOUR_SECURE_CODE_123"
  }'
```

### If ALL Admin Passwords Forgotten:

**Option 1: Firebase Console** (Last Resort)
1. Go to: https://console.firebase.google.com
2. Select project: `centralized-gcp`
3. Authentication → Users
4. Find admin account → Reset Password
5. Check email for reset link

**Option 2: Create New Admin**
```bash
curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/createBackupAdmin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "emergency-admin@yourcompany.com",
    "password": "SecurePassword123!",
    "displayName": "Emergency Admin",
    "verificationCode": "YOUR_SECURE_CODE_123"
  }'
```

---

## 📊 List All Admin Accounts

```bash
curl https://asia-southeast1-centralized-gcp.cloudfunctions.net/listAdminAccounts
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "admins": [
    {
      "uid": "...",
      "email": "admin@yourcompany.com",
      "displayName": "Admin User",
      "isBackupAdmin": false
    }
  ]
}
```

---

## 🔒 Security Checklist

- [ ] Deploy recovery functions
- [ ] Set recovery code (store securely!)
- [ ] Create at least 2 backup admin accounts
- [ ] Document all admin accounts
- [ ] Store credentials in password manager
- [ ] Test recovery procedures
- [ ] Set up Firebase Console access
- [ ] Review admin accounts quarterly

---

## 📚 Full Documentation

See `ADMIN_RECOVERY_GUIDE.md` for complete documentation including:
- Detailed recovery procedures
- Security best practices
- Corporate-level recommendations
- Testing procedures
- Audit logging

---

## ⚠️ Important Notes

1. **Recovery Code**: Store securely! Without it, Cloud Functions won't work.
2. **Backup Admins**: Create immediately - don't wait for emergency!
3. **Documentation**: Document all admin accounts in company security docs.
4. **Firebase Console**: Maintain access for last resort recovery.
5. **Regular Reviews**: Review admin accounts quarterly.

---

**Status**: ✅ Ready for Deployment  
**Priority**: 🔴 CRITICAL - Implement Immediately
