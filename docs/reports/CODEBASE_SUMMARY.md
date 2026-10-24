# 📖 Codebase Summary & Quick Reference

## Project Overview

**Team Management Application** - A React-based team management system with role-based access control using Firebase Authentication and Firestore.

**Version**: 0.1.0  
**Last Updated**: 2024-01-15

---

## 🏗️ Architecture

### Frontend
- **Framework**: React 18.2.0
- **Routing**: React Router DOM 6.8.1
- **Styling**: Tailwind CSS 3.2.7
- **Build Tool**: Create React App (react-scripts 5.0.1)

### Backend
- **Authentication**: Firebase Authentication (Email/Password)
- **Database**: Cloud Firestore
- **Serverless Functions**: Firebase Cloud Functions (Node 20)
- **Hosting**: Firebase Hosting

### File Structure
```
Test_X/
├── src/
│   ├── components/
│   │   ├── dashboards/
│   │   │   ├── AdminDashboard.js (User management)
│   │   │   ├── SomDashboard.js (Senior Ops Manager)
│   │   │   ├── OmDashboard.js (Operations Manager)
│   │   │   ├── TrainerDashboard.js (Trainer - creates updates)
│   │   │   ├── TeamLeaderDashboard.js (Team management)
│   │   │   └── TeamMemberDashboard.js (View & acknowledge updates)
│   │   ├── LoginForm.js (Auth - login/signup)
│   │   ├── ProtectedRoute.js (Route protection)
│   │   ├── PendingApproval.js (Waiting for admin approval)
│   │   ├── AcknowledgmentModal.js
│   │   └── ChangePasswordModal.js
│   ├── contexts/
│   │   └── AuthContext.js (Global auth state)
│   ├── firebase/
│   │   ├── config.js (Firebase initialization)
│   │   ├── auth.js (Auth functions: signIn, signUp, signOut)
│   │   └── firestore.js (All database operations)
│   ├── App.js (Main app & routing)
│   └── index.js (Entry point)
├── functions/
│   └── index.js (Cloud Functions: password reset, user deletion)
├── firestore.rules (Security rules)
├── firebase.json (Firebase config)
└── package.json (Dependencies)
```

---

## 👥 User Roles & Permissions

| Role | Description | Key Permissions |
|------|-------------|----------------|
| **Admin** | System administrator | • Manage all users<br>• Approve/reject role requests<br>• Reset passwords<br>• Delete users<br>• Access all data |
| **SOM** | Senior Operations Manager | • View all Operations Managers<br>• View team updates across organization<br>• Oversight capabilities |
| **OM** | Operations Manager | • View all Team Leaders<br>• View team updates<br>• Management oversight |
| **Trainer** | Trainer | • Create updates for all users<br>• View all users (for exclusion)<br>• Special "trainer-updates" collection |
| **Team Leader** | Team leader | • Create/manage teams<br>• Create updates for team<br>• Manage team members<br>• Requires admin approval |
| **Team Member** | Regular member | • View team updates<br>• Acknowledge updates<br>• Access tools/templates<br>• Auto-approved |

---

## 🗄️ Database Schema

### Collections

1. **users**
   ```javascript
   {
     email: string,
     displayName: string,
     role: 'admin' | 'som' | 'om' | 'trainer' | 'team_leader' | 'team_member',
     teamId: string | null,
     isApproved: boolean,
     pendingApproval: boolean,
     status: 'active' | 'rejected',
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

2. **teams**
   ```javascript
   {
     name: string,
     teamLeaderId: string,
     description: string,
     members: string[], // Array of user IDs
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

3. **updates**
   ```javascript
   {
     teamId: string | 'trainer-updates',
     title: string,
     content: string,
     createdBy: string, // User ID
     deadline: timestamp | null,
     status: 'pending' | 'completed',
     createdAt: timestamp
   }
   ```

4. **acknowledgments**
   ```javascript
   {
     updateId: string,
     userId: string,
     comment: string,
     acknowledgedAt: timestamp
   }
   ```

5. **notifications**
   ```javascript
   {
     userId: string,
     type: 'new_update' | 'update_acknowledged' | 'migration_request' | 'deadline_warning' | 'update_deleted',
     title: string,
     message: string,
     updateId: string | null,
     isRead: boolean,
     createdAt: timestamp,
     readAt: timestamp | null
   }
   ```

6. **migrations**
   ```javascript
   {
     userId: string,
     userDisplayName: string,
     userEmail: string,
     fromTeamId: string,
     fromTeamName: string,
     toTeamId: string,
     toTeamName: string,
     requestingLeaderId: string,
     currentTeamLeaderId: string,
     status: 'pending' | 'approved' | 'denied',
     createdAt: timestamp,
     approvedAt: timestamp | null,
     deniedAt: timestamp | null
   }
   ```

7. **templates**
   ```javascript
   {
     userId: string,
     title: string,
     description: string,
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

8. **password_resets** (Managed by Cloud Functions)
   ```javascript
   {
     temporaryPassword: string,
     resetBy: string, // Admin user ID
     resetAt: timestamp,
     userEmail: string,
     userName: string,
     used: boolean
   }
   ```

---

## 🔑 Key Functions Reference

### Authentication (`src/firebase/auth.js`)
- `signIn(email, password)` - User login
- `signUp(email, password, displayName, role)` - User registration
- `signOutUser()` - Sign out
- `onAuthStateChange(callback)` - Listen to auth state changes
- `changePassword(currentPassword, newPassword)` - Change user password
- `resetUserPassword(userId)` - Admin password reset (via Cloud Function)
- `deleteUserFromAuth(userId)` - Admin delete user (via Cloud Function)

### Firestore Operations (`src/firebase/firestore.js`)

**Team Management**:
- `createTeam(teamName, teamLeaderId, description)`
- `getTeam(teamId)`
- `getTeamsByLeader(teamLeaderId)`
- `addMemberToTeam(teamId, userId, requestingLeaderId)`
- `removeMemberFromTeam(teamId, userId)`
- `getTeamMembers(teamId)`

**Updates**:
- `createUpdate(teamId, title, content, createdBy, deadline, excludedUserIds)`
- `getUpdatesByTeam(teamId)`
- `deleteUpdate(updateId)`

**Acknowledgments**:
- `acknowledgeUpdate(updateId, userId, comment)`
- `getAcknowledgmentStatus(updateId)`
- `getUserAcknowledgment(updateId, userId)`
- `getUpdateAcknowledgmentBreakdown(updateId, teamMembers, deadline)`

**User Management**:
- `getAllUsers()`
- `getAllTeamMemberUsers()`
- `getAllTeamLeaderUsers()`
- `getAllOperationsManagerUsers()`
- `updateUserRole(userId, newRole)`
- `deleteUserCompletely(userId)`
- `getPendingTeamLeaders()`
- `approveTeamLeader(userId)`
- `rejectTeamLeader(userId)`

**Migrations**:
- `getMigrationRequests(teamLeaderId)`
- `approveMigration(migrationId)`
- `denyMigration(migrationId)`

**Templates**:
- `createTemplate(userId, title, description)`
- `getTemplatesByUser(userId)`
- `updateTemplate(templateId, title, description)`
- `deleteTemplate(templateId)`

**Notifications**:
- `createNotification(userId, type, title, message, updateId)`
- `getNotificationsByUser(userId)`
- `markNotificationAsRead(notificationId)`
- `markAllNotificationsAsRead(userId)`
- `deleteNotification(notificationId)`
- `bumpUsersForUpdate(updateId, userIds)`

---

## 🛣️ Routes

| Route | Component | Required Role | Description |
|-------|-----------|---------------|-------------|
| `/` | DashboardRedirect | Any authenticated | Redirects based on role |
| `/login` | LoginForm | None (public) | Login/signup page |
| `/pending-approval` | PendingApproval | None (public) | Waiting for approval page |
| `/admin` | AdminDashboard | admin | User management |
| `/som` | SomDashboard | som | Senior Ops Manager dashboard |
| `/om` | OmDashboard | om | Operations Manager dashboard |
| `/trainer` | TrainerDashboard | trainer | Trainer dashboard |
| `/team-leader` | TeamLeaderDashboard | team_leader | Team management |
| `/team-member` | TeamMemberDashboard | team_member | View updates & acknowledge |

---

## 🔒 Security Rules Overview

### Users Collection
- Users can read/write their own document
- Admins can read/write all users
- Team leaders can read team members
- OMs can read team leaders
- SOMs can read OMs
- Trainers can read all users

### Teams Collection
- Team leaders can create/update their own teams
- Members can read teams they belong to
- Team leaders can read any team (for migrations)
- Admins can read all teams

### Updates Collection
- Team leaders can create updates for their teams
- Managers (OM/SOM/Trainer) can create updates for any team
- Trainers can create updates without team (trainer-updates)
- Team members can read updates for their teams
- Trainers can read their own updates

### Acknowledgments Collection
- Users can create/read their own acknowledgments
- Team leaders can read acknowledgments for their team's updates
- Admins can read all acknowledgments

### Migrations Collection
- Team leaders can read migrations where they're current owner or requester
- Team leaders can create/update/delete their own migration requests
- Admins can read all migrations

### Notifications Collection
- Users can read/update/delete their own notifications
- Any authenticated user can create notifications
- Admins can read all notifications

### Templates Collection
- Users can CRUD their own templates
- Admins can read all templates

---

## 🚀 Cloud Functions

### Deployed Functions

1. **resetUserPassword** (`functions/index.js`)
   - Region: asia-southeast1
   - Method: POST
   - Auth: Admin only
   - Purpose: Reset user password to temporary password

2. **deleteUserFromAuth** (`functions/index.js`)
   - Region: asia-southeast1
   - Method: POST
   - Auth: Admin only
   - Purpose: Delete user from Firebase Authentication

### Function URLs
- Base: `https://asia-southeast1-YOUR_PROJECT.cloudfunctions.net/`
- Configure via: `REACT_APP_FUNCTIONS_URL` environment variable

---

## 🔧 Environment Variables

### Required Variables
```bash
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

### Optional Variables
```bash
REACT_APP_FUNCTIONS_URL=https://asia-southeast1-YOUR_PROJECT.cloudfunctions.net/resetUserPassword
REACT_APP_CLOUD_LOGGING_FUNCTION_URL=https://asia-southeast1-YOUR_PROJECT.cloudfunctions.net/logToCloudLogging
```

---

## 📦 Dependencies

### Production Dependencies
- `react`: ^18.2.0
- `react-dom`: ^18.2.0
- `react-router-dom`: ^6.8.1
- `firebase`: ^9.17.2
- `web-vitals`: ^2.1.4

### Dev Dependencies
- `tailwindcss`: ^3.2.7
- `autoprefixer`: ^10.4.14
- `postcss`: ^8.4.21
- `react-scripts`: 5.0.1

### Cloud Functions Dependencies
- `firebase-admin`: ^11.11.0
- `firebase-functions`: ^4.5.0

---

## 🐛 Known Issues

1. **501+ console.log statements** - ✅ Resolved: Centralized logger created
2. **No error tracking** - ✅ Resolved: Google Cloud Error Reporting integrated
3. **Outdated Firebase SDK** - ✅ Resolved: Upgraded to v10.13.2
4. **Large dashboard components** - Some files are 1800+ lines, should be refactored
5. **No pagination** - Loading all documents at once
6. **No caching strategy** - All data fetched fresh every time
7. **Missing composite indexes** - Some queries may fail until indexes created

See `AUDIT_REPORT.md` and `SCALABILITY_RELIABILITY_RECOMMENDATIONS.md` for detailed issues and recommendations.

---

## 🎯 Quick Commands

### Development
```bash
npm start          # Start dev server
npm run build      # Build for production
npm test           # Run tests
```

### Firebase
```bash
firebase login                    # Login to Firebase
firebase deploy                   # Deploy everything
firebase deploy --only hosting    # Deploy hosting only
firebase deploy --only functions  # Deploy functions only
firebase deploy --only firestore:rules  # Deploy rules only
firebase emulators:start          # Start local emulators
```

### Functions
```bash
cd functions
npm install        # Install function dependencies
npm run lint       # Lint functions
npm run serve      # Test functions locally
```

---

## 📚 Additional Documentation

- `README.md` - Setup and basic usage
- `AUDIT_REPORT.md` - Security and functionality audit
- `SCALABILITY_RELIABILITY_RECOMMENDATIONS.md` - Comprehensive improvement recommendations
- `SECURITY_UPDATE.md` - Security improvements made
- `ENV_SECURITY_GUIDE.md` - Environment variable security guide

---

## 🔍 Finding Code

### Common Searches

**To find authentication logic**:
- `src/firebase/auth.js` - Auth functions
- `src/contexts/AuthContext.js` - Auth state management
- `src/components/LoginForm.js` - Login UI

**To find database operations**:
- `src/firebase/firestore.js` - All Firestore operations

**To find dashboard code**:
- `src/components/dashboards/[Role]Dashboard.js` - Role-specific dashboards

**To find routing**:
- `src/App.js` - Route definitions
- `src/components/ProtectedRoute.js` - Route protection logic

**To find Cloud Functions**:
- `functions/index.js` - All Cloud Functions

**To find security rules**:
- `firestore.rules` - Firestore security rules

---

## 🆘 Troubleshooting

### Common Issues

1. **"Permission denied" errors**
   - Check Firestore rules in `firestore.rules`
   - Verify user role in Firestore
   - Check if user is authenticated

2. **"Module not found" errors**
   - Run `npm install`
   - Check if file paths are correct
   - Verify imports use correct casing

3. **Environment variable issues**
   - Ensure `.env` file exists
   - Check variable names start with `REACT_APP_`
   - Restart dev server after changing `.env`

4. **Firebase connection issues**
   - Verify Firebase config in `.env`
   - Check Firebase project is active
   - Verify internet connection

5. **Cloud Function errors**
   - Check function logs: `firebase functions:log`
   - Verify function is deployed: `firebase functions:list`
   - Check authentication token in request

---

**Last Updated**: 2024-01-15
