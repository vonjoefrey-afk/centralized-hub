# Team Management Application

A modern, high-performance React application built with Vite and Firebase for comprehensive team management, featuring robust role-based access control and SPII monitoring.

## ✨ Features

### Authentication & RBAC
- **Secure Authentication**: Firebase Auth with secondary Google SSO migration path.
- **Granular Roles**: 
  - **Admin**: System-wide management, user approval, and feature flag control.
  - **Trainer**: Global update distribution across all teams.
  - **Team Leader (TL)**: Team-specific management, shift rotations, and case tracking overviews.
  - **Team Member**: Access to personal tools, templates, and shift acknowledgment.

### Dashboards & Tools
- **Case Tracker**: Real-time logging of customer interactions with precision sorting.
- **Shift Management**: AI-powered shift rotation with automated notifications to Google Chat.
- **SPII Monitoring**: Real-time detection of Sensitive Personal Identifiable Information with automated audit logging.
- **Template Library**: Organized storage for commonly used team responses with easy copy-paste.
- **Metric Analytics**: Visual data representations for team productivity and status.

## 🛠️ Tech Stack

- **Framework**: [React 18](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: React Context API
- **Backend/DB**: [Firebase](https://firebase.google.com/) (Auth, Firestore, Cloud Functions)
- **Monitoring**: Google Cloud Logging & Error Reporting

## 🚀 Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Your credentials are never stored in the code. Copy the template and fill in your Firebase values:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` with your actual Firebase Project keys.*

3. **Deploy Cloud Functions**:
   This app requires backend functions for password management and shift automation:
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components and Dashboard Tabs
├── contexts/            # Auth and Theme context providers
├── firebase/            # Firebase SDK initialization and helpers
├── hooks/               # Custom React hooks
├── services/            # API and notification services
├── utils/               # Handlers for logging, audio, and SPII detection
└── design-tokens.js     # Global design system configuration
```

## 🔒 Security
- **Strict Linting**: Environment variables are checked at runtime.
- **Secure Config**: Service account keys and .env files are excluded from version control.
- **RBAC**: Firestore rules ensure users can only access data permitted by their verified role.

---
© 2026 Team Management App



