# 📁 File Reference Guide

Quick reference guide to locate specific functionality in the codebase.

---

## 🔍 File Organization

### Frontend Source Files (`src/`)

#### **Core Application Files**
| File | Purpose | Key Exports/Components |
|------|---------|------------------------|
| `src/index.js` | Application entry point | React root rendering |
| `src/App.js` | Main app component, routing | App, DashboardRedirect, Routes |
| `src/index.css` | Global styles | Tailwind imports, global CSS |

#### **Authentication & Context**
| File | Purpose | Key Functions/Components |
|------|---------|-------------------------|
| `src/contexts/AuthContext.js` | Global auth state management | AuthProvider, useAuth hook |
| `src/firebase/config.js` | Firebase initialization | `auth`, `db`, Firebase app instance |
| `src/firebase/auth.js` | Authentication operations | `signIn`, `signUp`, `signOutUser`, `changePassword`, `resetUserPassword`, `USER_ROLES` |
| `src/components/LoginForm.js` | Login/signup UI | LoginForm component |

#### **Route Protection**
| File | Purpose | Key Components |
|------|---------|----------------|
| `src/components/ProtectedRoute.js` | Role-based route protection | ProtectedRoute component |

#### **Dashboard Components** (`src/components/dashboards/`)
| File | Lines | Purpose | Key Features |
|------|-------|---------|--------------|
| `AdminDashboard.js` | ~500 | Admin user management | • User list with roles<br>• Role assignment<br>• User deletion<br>• Approve/reject team leaders<br>• Password reset |
| `SomDashboard.js` | ~1089 | Senior Ops Manager view | • View all OMs<br>• View team updates across org<br>• Analytics placeholder |
| `OmDashboard.js` | ~1089 | Operations Manager view | • View all Team Leaders<br>• View team updates<br>• Management tools |
| `TrainerDashboard.js` | ~991 | Trainer dashboard | • Create updates for all users<br>• Exclude specific users<br>• View acknowledgment status<br>• Template management |
| `TeamLeaderDashboard.js` | ~2091 | Team management | • Create/manage teams<br>• Add/remove members<br>• Create updates<br>• View acknowledgments<br>• Migration requests<br>• Templates |
| `TeamMemberDashboard.js` | ~1892 | Member view | • View pending updates<br>• Acknowledge updates<br>• View acknowledged updates<br>• Tools & templates<br>• Notifications<br>• Calculator |

#### **Shared Components**
| File | Purpose | Key Components |
|------|---------|----------------|
| `src/components/PendingApproval.js` | Waiting for admin approval page | PendingApproval component |
| `src/components/AcknowledgmentModal.js` | Modal for acknowledging updates | AcknowledgmentModal component |
| `src/components/ChangePasswordModal.js` | Password change modal | ChangePasswordModal component |

#### **Database Operations** (`src/firebase/`)
| File | Lines | Purpose | Key Functions |
|------|-------|---------|---------------|
| `src/firebase/firestore.js` | ~1366 | All Firestore operations | • Team management (createTeam, getTeam, etc.)<br>• Updates (createUpdate, getUpdatesByTeam, deleteUpdate)<br>• Acknowledgments (acknowledgeUpdate, getAcknowledgmentStatus)<br>• User management (getAllUsers, updateUserRole, deleteUserCompletely)<br>• Migrations (getMigrationRequests, approveMigration, denyMigration)<br>• Templates (createTemplate, getTemplatesByUser, updateTemplate, deleteTemplate)<br>• Notifications (createNotification, getNotificationsByUser, markNotificationAsRead) |

---

### Backend Files (`functions/`)

#### **Cloud Functions**
| File | Purpose | Exported Functions |
|------|---------|-------------------|
| `functions/index.js` | Cloud Functions | `resetUserPassword`, `deleteUserFromAuth` |
| `functions/package.json` | Function dependencies | Node 20, firebase-admin, firebase-functions |

---

### Configuration Files

#### **Firebase Configuration**
| File | Purpose |
|------|---------|
| `firebase.json` | Firebase project configuration (hosting, functions, firestore) |
| `firestore.rules` | Firestore security rules (access control) |
| `firestore-*.rules` | Alternative/backup rule files |

#### **Build Configuration**
| File | Purpose |
|------|---------|
| `package.json` | Frontend dependencies and scripts |
| `tailwind.config.js` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS configuration |

#### **Environment & Git**
| File | Purpose |
|------|---------|
| `.gitignore` | Files to ignore in version control |
| `.env` | Environment variables (not in git, see `.env.example` if exists) |

---

### Utility & Script Files

| File | Purpose |
|------|---------|
| `create-admin.js` | Script to create admin user |
| `create-first-admin.js` | Script to create first admin |
| `cleanup-users.js` | Script to cleanup users |

---

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Main project documentation |
| `AUDIT_REPORT.md` | Security and functionality audit results |
| `SCALABILITY_RELIABILITY_RECOMMENDATIONS.md` | Comprehensive improvement recommendations |
| `CODEBASE_SUMMARY.md` | Quick reference for codebase structure |
| `FILE_REFERENCE.md` | This file - file location guide |
| `SECURITY_UPDATE.md` | Security improvements documentation |
| `ENV_SECURITY_GUIDE.md` | Environment variable security guide |
| `update_env_instructions.txt` | Instructions for updating environment variables |

---

## 🔎 Finding Specific Functionality

### User Authentication
- **Login/Signup UI**: `src/components/LoginForm.js`
- **Auth Logic**: `src/firebase/auth.js`
- **Auth State**: `src/contexts/AuthContext.js`
- **Firebase Config**: `src/firebase/config.js`

### User Management
- **Admin Dashboard**: `src/components/dashboards/AdminDashboard.js`
- **User CRUD Operations**: `src/firebase/firestore.js` (getAllUsers, updateUserRole, deleteUserCompletely)
- **Password Reset**: `functions/index.js` (resetUserPassword function)

### Team Management
- **Team Leader Dashboard**: `src/components/dashboards/TeamLeaderDashboard.js`
- **Team Operations**: `src/firebase/firestore.js` (createTeam, getTeam, addMemberToTeam, removeMemberFromTeam)

### Updates & Acknowledgments
- **Create Updates**: `src/components/dashboards/TeamLeaderDashboard.js` (UI) + `src/firebase/firestore.js` (createUpdate)
- **View Updates**: `src/components/dashboards/TeamMemberDashboard.js`
- **Acknowledge Updates**: `src/components/AcknowledgmentModal.js` (UI) + `src/firebase/firestore.js` (acknowledgeUpdate)

### Notifications
- **Notification System**: `src/firebase/firestore.js` (createNotification, getNotificationsByUser, markNotificationAsRead)
- **Notification Display**: All dashboard components have notification UI

### Migrations (Team Member Transfers)
- **Migration Logic**: `src/firebase/firestore.js` (getMigrationRequests, approveMigration, denyMigration)
- **Migration UI**: `src/components/dashboards/TeamLeaderDashboard.js`

### Templates
- **Template Operations**: `src/firebase/firestore.js` (createTemplate, getTemplatesByUser, updateTemplate, deleteTemplate)
- **Template UI**: `src/components/dashboards/TeamLeaderDashboard.js` and `src/components/dashboards/TeamMemberDashboard.js`

### Security Rules
- **Firestore Rules**: `firestore.rules`
- **Route Protection**: `src/components/ProtectedRoute.js`
- **Auth Guards**: `src/App.js` (DashboardRedirect component)

### Routing
- **Route Definitions**: `src/App.js`
- **Route Protection**: `src/components/ProtectedRoute.js`
- **Navigation**: React Router DOM (imported in `src/App.js`)

### Styling
- **Global Styles**: `src/index.css`
- **Tailwind Config**: `tailwind.config.js`
- **Component Styles**: Inline Tailwind classes in components

### Cloud Functions
- **All Functions**: `functions/index.js`
- **Function Config**: `firebase.json` (functions section)

---

## 📊 Code Statistics

### Largest Files (by line count)
1. `TeamLeaderDashboard.js` - 2,091 lines
2. `TeamMemberDashboard.js` - 1,892 lines
3. `firestore.js` - 1,366 lines
4. `OmDashboard.js` - 1,089 lines
5. `SomDashboard.js` - 1,089 lines
6. `TrainerDashboard.js` - 991 lines

**Recommendation**: Consider refactoring large dashboard components into smaller, reusable components.

### Most Imported Files
- `src/firebase/firestore.js` - Imported in all dashboard components
- `src/firebase/auth.js` - Imported in App.js, LoginForm.js, ProtectedRoute.js
- `src/contexts/AuthContext.js` - Imported in all components that need auth

---

## 🎯 Quick Navigation Tips

### To Add a New Feature
1. **New Database Operation**: Add to `src/firebase/firestore.js`
2. **New Auth Feature**: Add to `src/firebase/auth.js`
3. **New UI Component**: Create in `src/components/` or `src/components/dashboards/`
4. **New Route**: Add to `src/App.js` routes array
5. **New Security Rule**: Add to `firestore.rules`

### To Debug an Issue
1. **Auth Issues**: Check `src/firebase/auth.js` and `src/contexts/AuthContext.js`
2. **Permission Errors**: Check `firestore.rules` and user role
3. **Routing Issues**: Check `src/App.js` and `src/components/ProtectedRoute.js`
4. **Data Loading Issues**: Check `src/firebase/firestore.js` and component useEffect hooks
5. **UI Issues**: Check component files in `src/components/dashboards/`

### To Modify Security
1. **Firestore Rules**: Edit `firestore.rules` → Deploy: `firebase deploy --only firestore:rules`
2. **Route Protection**: Modify `src/components/ProtectedRoute.js`
3. **Auth Logic**: Modify `src/firebase/auth.js`
4. **Cloud Function Security**: Modify `functions/index.js`

### To Deploy Changes
1. **Frontend**: `npm run build` → `firebase deploy --only hosting`
2. **Functions**: `firebase deploy --only functions`
3. **Rules**: `firebase deploy --only firestore:rules`
4. **Everything**: `firebase deploy`

---

## 🔗 File Dependencies

### Core Dependencies Flow
```
src/index.js
  └─> src/App.js
        ├─> src/contexts/AuthContext.js
        │     └─> src/firebase/auth.js
        │           └─> src/firebase/config.js
        ├─> src/components/LoginForm.js
        │     └─> src/firebase/auth.js
        └─> src/components/dashboards/*.js
              ├─> src/contexts/AuthContext.js
              └─> src/firebase/firestore.js
                    └─> src/firebase/config.js
```

---

**Last Updated**: 2024-01-15
