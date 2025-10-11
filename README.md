# Team Management Application

A React-based team management application with role-based access control using Firebase authentication and Firestore database.

## Features

### Authentication
- User registration and login
- Role-based access control (Admin, Team Leader, Team Member)
- Protected routes based on user roles

### Admin Dashboard
- User management with role assignment
- View all users and their current roles
- Change user roles dynamically
- Placeholder tabs for future features (System Settings, Analytics)

### Team Leader Dashboard
- Create and manage teams
- Upload updates that need acknowledgment from team members
- View team updates and their status
- Placeholder tabs for future features (Team Members, Analytics)

### Team Member Dashboard
- View pending updates that need acknowledgment
- Acknowledge updates from team leaders
- View previously acknowledged updates
- Placeholder tabs for future features (Team Info, My Activity)

## Tech Stack

- **Frontend**: React 18, React Router DOM
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Authentication, Firestore)
- **Deployment**: Ready for GitHub deployment

## Setup Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Firebase**:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication (Email/Password)
   - Enable Firestore Database
   - Copy your Firebase config and replace the placeholder values in `src/firebase/config.js`

3. **Set up Firestore Security Rules**:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Users can read/write their own user document
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       
       // Admins can read/write all user documents
       match /users/{userId} {
         allow read, write: if request.auth != null && 
           get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
       }
       
       // Teams are readable by team members and leaders
       match /teams/{teamId} {
         allow read: if request.auth != null && 
           (resource.data.teamLeaderId == request.auth.uid || 
            resource.data.members[request.auth.uid] in resource.data.members);
         allow write: if request.auth != null && 
           get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'team_leader';
       }
       
       // Updates are readable by team members
       match /updates/{updateId} {
         allow read: if request.auth != null && 
           get(/databases/$(database)/documents/teams/$(resource.data.teamId)).data.members[request.auth.uid] in get(/databases/$(database)/documents/teams/$(resource.data.teamId)).data.members;
         allow write: if request.auth != null && 
           get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'team_leader';
       }
       
       // Acknowledgments are readable/writable by team members
       match /acknowledgments/{ackId} {
         allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
       }
     }
   }
   ```

4. **Start the development server**:
   ```bash
   npm start
   ```

## Project Structure

```
src/
├── components/
│   ├── dashboards/
│   │   ├── AdminDashboard.js
│   │   ├── TeamLeaderDashboard.js
│   │   └── TeamMemberDashboard.js
│   ├── LoginForm.js
│   └── ProtectedRoute.js
├── contexts/
│   └── AuthContext.js
├── firebase/
│   ├── auth.js
│   ├── config.js
│   └── firestore.js
├── App.js
├── index.js
└── index.css
```

## User Roles

- **Admin**: Can manage user roles and permissions
- **Team Leader**: Can create teams and upload updates for acknowledgment
- **Team Member**: Can acknowledge updates and view team information

## Future Enhancements

The application is designed with placeholder tabs for future features:
- System Settings and Analytics for Admins
- Team Member management and Analytics for Team Leaders
- Team Info and Activity tracking for Team Members

## Deployment

The application is ready for deployment to platforms like:
- Firebase Hosting
- Vercel
- Netlify
- GitHub Pages

Make sure to set up environment variables for production Firebase configuration.
