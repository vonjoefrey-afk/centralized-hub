# 🔐 Admin Account Recovery & Management Guide

## 🚨 Critical Problem: Single Admin Account Risk

**Problem**: If you forget the password to your single admin account, you lose access to:
- User management
- Team leader approvals
- System administration
- All critical administrative functions

**Solution**: Implement multiple layers of admin account recovery and management.

---

## ✅ Recommended Corporate-Level Solutions

### 1. **Multiple Admin Accounts** (Primary Solution)

**Best Practice**: Always maintain **at least 2-3 admin accounts** with different emails.

**Why**:
- If one admin forgets password, others can reset it
- Redundancy prevents single point of failure
- Different admins can manage different aspects

**Implementation**:
```bash
# Create backup admin accounts using Cloud Function
curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/createBackupAdmin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "backup-admin@yourcompany.com",
    "password": "SecurePassword123!",
    "displayName": "Backup Admin",
    "verificationCode": "YOUR_RECOVERY_CODE"
  }'
```

### 2. **Super Admin Account** (Emergency Recovery)

**Best Practice**: Create a **super admin account** that is:
- Used only for emergency recovery
- Password stored securely (password manager, secure vault)
- Different email domain or separate account
- Documented in company security procedures

**Example**:
- Primary Admin: `admin@yourcompany.com`
- Backup Admin: `backup-admin@yourcompany.com`
- Super Admin: `super-admin@yourcompany.com` or `admin-recovery@yourcompany.com`

### 3. **Admin Password Reset via Cloud Function**

**Feature**: Emergency password reset function for admin accounts.

**Security**: Requires verification code (set in environment variables).

**Usage**:
```bash
curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/emergencyAdminPasswordReset \
  -H "Content-Type: application/json" \
  -d '{
    "adminEmail": "admin@yourcompany.com",
    "newPassword": "NewSecurePassword123!",
    "verificationCode": "YOUR_RECOVERY_CODE"
  }'
```

### 4. **Email-Based Recovery** (Future Enhancement)

**Best Practice**: Implement email-based password reset for admin accounts.

**How it works**:
1. Admin requests password reset
2. System sends verification code to admin email
3. Admin enters code + new password
4. Password is reset

**Note**: This requires additional Firebase configuration for email templates.

### 5. **Firebase Console Access** (Last Resort)

**Best Practice**: Maintain access to Firebase Console for emergency recovery.

**Steps**:
1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project: `centralized-gcp`
3. Navigate to Authentication → Users
4. Find admin account
5. Click "Reset Password" or "Change Password"
6. New password will be sent to admin email (if email is verified)

**Limitation**: Requires Firebase Console access and verified email.

---

## 🛠️ Implementation Steps

### Step 1: Deploy Admin Recovery Functions

```bash
# Deploy the admin recovery Cloud Functions
firebase deploy --only functions:emergencyAdminPasswordReset,functions:listAdminAccounts,functions:createBackupAdmin
```

### Step 2: Set Recovery Code (Environment Variable)

```bash
# Set in Firebase Functions environment
firebase functions:config:set admin.recovery_code="YOUR_SECURE_CODE_HERE"

# Or in .env file for local development
ADMIN_RECOVERY_CODE=YOUR_SECURE_CODE_HERE
```

### Step 3: Create Backup Admin Accounts

**Option A: Using Cloud Function** (Recommended)
```bash
curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/createBackupAdmin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "backup-admin@yourcompany.com",
    "password": "SecurePassword123!",
    "displayName": "Backup Admin",
    "verificationCode": "YOUR_RECOVERY_CODE"
  }'
```

**Option B: Using Script** (See `create-backup-admin.js`)

**Option C: Using Admin Dashboard** (After UI is implemented)

### Step 4: Document Admin Accounts

**Create a secure document** (password manager, secure vault) with:
- Admin account emails
- Account purposes (primary, backup, super admin)
- Last password change date
- Recovery procedures

**Example**:
```
Admin Accounts for centralized-gcp:
1. Primary Admin: admin@yourcompany.com
   - Purpose: Daily operations
   - Created: 2024-01-15
   
2. Backup: backup-admin@yourcompany.com
   - Purpose: Emergency recovery
   - Created: 2024-01-15
   
3. Super Admin: super-admin@yourcompany.com
   - Purpose: Last resort recovery
   - Created: 2024-01-15
   - Password stored in: [Company Password Manager]
```

---

## 🔒 Security Best Practices

### 1. **Password Management**
- Use strong, unique passwords for each admin account
- Store passwords in company password manager (1Password, LastPass, etc.)
- Rotate passwords regularly (every 90 days)
- Use password complexity requirements

### 2. **Access Control**
- Limit who knows admin account credentials
- Use principle of least privilege
- Document who has access to which admin accounts
- Review admin access quarterly

### 3. **Recovery Code Security**
- Store recovery code securely (separate from passwords)
- Limit who knows the recovery code
- Rotate recovery code annually
- Document recovery code location

### 4. **Audit Logging**
- All admin password resets are logged in `admin_audit_log` collection
- Review audit logs monthly
- Alert on suspicious admin activities

### 5. **Multi-Factor Authentication** (Future)
- Enable MFA for admin accounts
- Use hardware security keys for super admin
- Require MFA for password resets

---

## 📋 Emergency Recovery Procedures

### Scenario 1: Admin Forgot Password (Other Admins Available)

1. **Use another admin account** to reset the password:
   - Log in with backup admin account
   - Go to Admin Dashboard
   - Use "Reset User Password" feature
   - Set new password for locked admin

2. **Or use Cloud Function**:
   ```bash
   curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/emergencyAdminPasswordReset \
     -H "Content-Type: application/json" \
     -d '{
       "adminEmail": "locked-admin@yourcompany.com",
       "newPassword": "NewPassword123!",
       "verificationCode": "YOUR_RECOVERY_CODE"
     }'
   ```

### Scenario 2: All Admin Passwords Forgotten

1. **Use Firebase Console**:
   - Access Firebase Console
   - Go to Authentication → Users
   - Reset password for any admin account
   - Check email for reset link

2. **Or use Cloud Function with recovery code**:
   ```bash
   # List all admin accounts first
   curl https://asia-southeast1-centralized-gcp.cloudfunctions.net/listAdminAccounts
   
   # Reset password for one admin
   curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/emergencyAdminPasswordReset \
     -H "Content-Type: application/json" \
     -d '{
       "adminEmail": "admin@yourcompany.com",
       "newPassword": "NewPassword123!",
       "verificationCode": "YOUR_RECOVERY_CODE"
     }'
   ```

3. **Or create new admin account**:
   ```bash
   curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/createBackupAdmin \
     -H "Content-Type: application/json" \
     -d '{
       "email": "emergency-admin@yourcompany.com",
       "password": "SecurePassword123!",
       "displayName": "Emergency Admin",
       "verificationCode": "YOUR_RECOVERY_CODE"
     }'
   ```

### Scenario 3: Admin Account Deleted/Compromised

1. **Create new admin account** using Cloud Function
2. **Review audit logs** to identify what happened
3. **Change all admin passwords** as precaution
4. **Review security settings** and access logs

---

## 🧪 Testing Recovery Procedures

### Test 1: Password Reset via Cloud Function
```bash
# Test emergency password reset
curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/emergencyAdminPasswordReset \
  -H "Content-Type: application/json" \
  -d '{
    "adminEmail": "test-admin@yourcompany.com",
    "newPassword": "TestPassword123!",
    "verificationCode": "YOUR_RECOVERY_CODE"
  }'
```

### Test 2: List Admin Accounts
```bash
# List all admin accounts
curl https://asia-southeast1-centralized-gcp.cloudfunctions.net/listAdminAccounts
```

### Test 3: Create Backup Admin
```bash
# Create backup admin account
curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/createBackupAdmin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "backup-test@yourcompany.com",
    "password": "TestPassword123!",
    "displayName": "Test Backup Admin",
    "verificationCode": "YOUR_RECOVERY_CODE"
  }'
```

---

## 📊 Admin Account Management Dashboard (Future)

**Planned Features**:
- View all admin accounts
- Create backup admin accounts
- Reset admin passwords (with verification)
- View admin audit logs
- Manage admin permissions

**Location**: Admin Dashboard → Admin Management Tab

---

## ⚠️ Important Notes

1. **Recovery Code**: Store the recovery code securely. Without it, Cloud Functions won't work.

2. **Email Verification**: Admin accounts should have verified emails for Firebase Console recovery.

3. **Backup Admins**: Create at least 2-3 backup admin accounts immediately.

4. **Documentation**: Document all admin accounts and recovery procedures in company security docs.

5. **Regular Reviews**: Review admin accounts quarterly and remove unused ones.

6. **Security**: Never share admin credentials via email or insecure channels.

---

## 🎯 Quick Checklist

- [ ] Deploy admin recovery Cloud Functions
- [ ] Set recovery code in environment variables
- [ ] Create at least 2 backup admin accounts
- [ ] Document all admin accounts securely
- [ ] Test recovery procedures
- [ ] Store recovery code in secure location
- [ ] Set up Firebase Console access
- [ ] Review and update security procedures
- [ ] Train team on recovery procedures
- [ ] Schedule quarterly admin account reviews

---

**Last Updated**: $(date)
**Project**: centralized-gcp
**Status**: ✅ Ready for Implementation
