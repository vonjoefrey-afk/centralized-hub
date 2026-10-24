# 🔐 Admin Account Management - Company Security Documentation

**Document Classification**: Internal Use Only  
**Last Updated**: January 10, 2026  
**Project**: centralized-gcp (Team Management Application)  
**Responsible Team**: IT Operations / System Administrators

---

## 📋 Executive Summary

This document provides complete information about admin account management, recovery procedures, and security protocols for the Team Management Application deployed on Firebase (centralized-gcp).

**Critical Information**: This system maintains multiple admin accounts and recovery mechanisms to prevent single points of failure and ensure business continuity.

---

## 👥 Admin Account Inventory

### Current Admin Accounts (As of January 10, 2026)

| Account Type | Email | Display Name | UID | Created | Status | Purpose |
|-------------|-------|--------------|-----|---------|--------|---------|
| Primary Admin | `accenture_admin_alpha@accenture.com` | Accenture Admin | Jjav4sdguNdq8nz1xIYxswlsTFt1 | Nov 12, 2025 | Active | Daily operations, user management |
| Backup Admin | `backup-admin@accenture.com` | Backup Admin | C2m8P04Ps3R6tloeW3BMbYDx2gG2 | Jan 10, 2026 | Active | Emergency recovery, redundancy |

**Total Admin Accounts**: 2

**Minimum Required**: 2 (Primary + Backup)

**Recommended**: 3 (Primary + Backup + Super Admin)

---

## 🔐 Credential Storage

### Primary Admin
- **Email**: `accenture_admin_alpha@accenture.com`
- **Password**: Stored in [Company Password Manager - Location TBD]
- **Last Password Change**: [To be updated]
- **Next Password Rotation**: [To be scheduled - 90 days from last change]

### Backup Admin
- **Email**: `backup-admin@accenture.com`
- **Password**: Stored in [Company Password Manager - Location TBD]
- **Last Password Change**: January 10, 2026
- **Next Password Rotation**: April 10, 2026

### Recovery Code
- **Code**: `fdffc744013a1c6e0faae4973e0cd44e`
- **Purpose**: Required for emergency password reset and backup admin creation
- **Storage Location**: [Company Password Manager - Location TBD]
- **Access**: Limited to authorized system administrators only
- **Rotation Schedule**: Annual (Next rotation: January 2027)

---

## 🛡️ Security Protocols

### Password Policy
- **Minimum Length**: 12 characters
- **Complexity**: Must include uppercase, lowercase, numbers, and special characters
- **Rotation Frequency**: Every 90 days
- **Reuse Policy**: Cannot reuse last 5 passwords
- **Storage**: Must be stored in company-approved password manager

### Access Control
- **Principle of Least Privilege**: Admin accounts should only be used when necessary
- **Shared Access**: Credentials shared only with authorized personnel
- **Access Review**: Quarterly review of who has access to admin accounts
- **Audit Logging**: All admin actions are logged in `admin_audit_log` collection

### Account Management
- **Creation**: New admin accounts require approval from IT Director
- **Deletion**: Admin accounts cannot be deleted without approval
- **Modification**: All changes to admin accounts must be documented

---

## 🚨 Emergency Recovery Procedures

### Scenario 1: Admin Forgot Password (Other Admins Available)

**Time to Resolution**: < 5 minutes

**Steps**:
1. Log in with backup admin account (`backup-admin@accenture.com`)
2. Navigate to Admin Dashboard
3. Go to Users section
4. Find the locked admin account
5. Click "Reset Password"
6. Generate new temporary password
7. Share new password securely with admin
8. Admin logs in and changes password immediately

**Alternative Method** (Using Cloud Function):
```bash
curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/emergencyAdminPasswordReset \
  -H "Content-Type: application/json" \
  -d '{
    "adminEmail": "locked-admin@accenture.com",
    "newPassword": "NewSecurePassword123!",
    "verificationCode": "fdffc744013a1c6e0faae4973e0cd44e"
  }'
```

**Documentation Required**: Log incident in admin_audit_log

---

### Scenario 2: All Admin Passwords Forgotten

**Time to Resolution**: < 15 minutes

**Method 1: Firebase Console** (Recommended)
1. Access Firebase Console: https://console.firebase.google.com
2. Select project: `centralized-gcp`
3. Navigate to: Authentication → Users
4. Find any admin account
5. Click on account → "Reset Password"
6. Check email for password reset link
7. Set new password
8. Log in and reset other admin passwords

**Method 2: Create New Admin** (If Firebase Console unavailable)
```bash
curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/createBackupAdmin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "emergency-admin@accenture.com",
    "password": "EmergencyPassword123!",
    "displayName": "Emergency Admin",
    "verificationCode": "fdffc744013a1c6e0faae4973e0cd44e"
  }'
```

**Method 3: Emergency Password Reset Function**
```bash
# First, list all admin accounts to find one to reset
curl https://asia-southeast1-centralized-gcp.cloudfunctions.net/listAdminAccounts

# Then reset password for one admin
curl -X POST https://asia-southeast1-centralized-gcp.cloudfunctions.net/emergencyAdminPasswordReset \
  -H "Content-Type: application/json" \
  -d '{
    "adminEmail": "accenture_admin_alpha@accenture.com",
    "newPassword": "NewPassword123!",
    "verificationCode": "fdffc744013a1c6e0faae4973e0cd44e"
  }'
```

**Documentation Required**: 
- Log incident in admin_audit_log
- Update this document with new admin account if created
- Notify IT Director

---

### Scenario 3: Admin Account Compromised

**Time to Resolution**: Immediate

**Steps**:
1. Immediately reset password for compromised account
2. Review admin_audit_log for suspicious activities
3. Change all admin account passwords as precaution
4. Review and revoke any unauthorized access
5. Notify security team
6. Document incident

---

## 🔧 Admin Recovery Functions

### Available Functions

1. **emergencyAdminPasswordReset**
   - URL: https://asia-southeast1-centralized-gcp.cloudfunctions.net/emergencyAdminPasswordReset
   - Purpose: Reset admin account password with verification code
   - Rate Limit: 5 requests per hour per IP
   - Authentication: Requires recovery code

2. **listAdminAccounts**
   - URL: https://asia-southeast1-centralized-gcp.cloudfunctions.net/listAdminAccounts
   - Purpose: List all admin accounts for management
   - Rate Limit: None (read-only)
   - Authentication: None (public, but should be restricted in production)

3. **createBackupAdmin**
   - URL: https://asia-southeast1-centralized-gcp.cloudfunctions.net/createBackupAdmin
   - Purpose: Create new backup admin account
   - Rate Limit: 5 requests per hour per IP
   - Authentication: Requires recovery code

---

## 📊 Audit & Monitoring

### Audit Log Collection
All admin actions are logged in Firestore collection: `admin_audit_log`

**Logged Events**:
- Password resets
- Backup admin creation
- Account modifications
- Access attempts

**Log Retention**: 1 year (review quarterly)

**Review Frequency**: Monthly by IT Operations

### Monitoring
- Monitor admin account login patterns
- Alert on suspicious activities
- Review audit logs monthly
- Track password reset frequency

---

## 📅 Maintenance Schedule

### Quarterly Tasks
- [ ] Review all admin accounts
- [ ] Verify backup admin accounts are active
- [ ] Review audit logs
- [ ] Update this documentation
- [ ] Review who has access to admin credentials
- [ ] Test recovery procedures

### Annual Tasks
- [ ] Rotate recovery code
- [ ] Review and update security procedures
- [ ] Conduct disaster recovery drill
- [ ] Review and update password policies

### Password Rotation Schedule
- **Primary Admin**: Every 90 days
- **Backup Admin**: Every 90 days
- **Recovery Code**: Annually

---

## 📞 Contact Information

### Emergency Contacts
- **IT Operations**: [Contact Info TBD]
- **System Administrator**: [Contact Info TBD]
- **Security Team**: [Contact Info TBD]

### Escalation Path
1. IT Operations (Level 1)
2. System Administrator (Level 2)
3. IT Director (Level 3)

---

## ✅ Testing & Validation

### Recovery Procedure Testing
**Frequency**: Quarterly

**Test Scenarios**:
1. Test password reset via backup admin
2. Test emergency password reset function
3. Test backup admin creation
4. Test admin account listing
5. Verify audit logging works

**Last Test Date**: [To be scheduled]
**Next Test Date**: [Quarterly from last test]

---

## 📝 Change Log

| Date | Change | Changed By | Approved By |
|------|--------|------------|-------------|
| Jan 10, 2026 | Initial documentation created | System Administrator | [Pending] |
| Jan 10, 2026 | Backup admin account created | System Administrator | [Pending] |
| | | | |

---

## ⚠️ Important Reminders

1. **Never share admin credentials via email or insecure channels**
2. **Store all credentials in company password manager only**
3. **Use recovery code only for legitimate emergencies**
4. **Document all admin account changes in this document**
5. **Test recovery procedures quarterly**
6. **Review audit logs monthly**
7. **Rotate passwords every 90 days**
8. **Rotate recovery code annually**

---

## 📚 Related Documentation

- `ADMIN_RECOVERY_GUIDE.md` - Technical recovery guide
- `ADMIN_RECOVERY_QUICK_START.md` - Quick reference
- Firebase Project: https://console.firebase.google.com/project/centralized-gcp

---

**Document Owner**: IT Operations  
**Review Cycle**: Quarterly  
**Next Review Date**: April 10, 2026  
**Version**: 1.0

---

**⚠️ CONFIDENTIAL**: This document contains sensitive security information. Access restricted to authorized personnel only.
