# Technical Documentation

## 1. Technology Stack

### Frontend
- **Framework**: React 18.2.0
- **Build Tool**: Vite (migrated from Create React App)
- **Routing**: React Router DOM 6.8.1
- **Styling**: Tailwind CSS 3.2.7 + Framer Motion 12.25.0 (Animations)
- **State Management**: React Context API (`AuthContext`)
- **Notifications**: React Hot Toast

### Backend (Serverless)
- **Platform**: Firebase
- **Authentication**: Firebase Authentication (Email/Password)
- **Database**: Cloud Firestore
- **Functions**: Firebase Cloud Functions (Node.js 20)
- **Hosting**: Firebase Hosting

### Development Tools
- **Linter**: ESLint (React App config)
- **Testing**: React Scripts Test (Jest/RTL)

## 2. Setup & Installation

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)

### Application Setup
1. **Clone the repository**:
   ```bash
   git clone <repository_url>
   cd Test_X
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env` file in the root directory with the following Firebase configuration:
   ```env
   REACT_APP_FIREBASE_API_KEY=your_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   # Optional
   REACT_APP_FUNCTIONS_URL=https://asia-southeast1-YOUR_PROJECT.cloudfunctions.net/resetUserPassword
   ```

4. **Run Locally**:
   ```bash
   npm start
   ```
   The application will be available at `http://localhost:5173` (Vite default).

### Cloud Functions Setup
1. Navigate to the functions directory:
   ```bash
   cd functions
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run locally (requires Firebase Emulators):
   ```bash
   npm run serve
   ```

## 3. Project Structure

```
Test_X/
├── src/
│   ├── components/
│   │   ├── dashboards/       # Role-specific dashboard views
│   │   ├── contexts/         # React Context (Auth)
│   │   ├── firebase/         # Firebase service modules (auth, firestore)
│   │   ├── hooks/            # Custom hooks
│   │   └── utils/            # Helper functions
│   ├── functions/            # Cloud Functions source code
│   ├── firestore.rules       # Database security rules
│   ├── firebase.json         # Firebase deployment config
│   └── vite.config.js        # Vite configuration
```

## 4. Deployment

### Building for Production
```bash
npm run build
```
This generates a static build in the `build/` directory (or `dist/` depending on Vite config).

### Deploying to Firebase
To deploy Hosting, Functions, and Rules:
```bash
firebase deploy
```

**Partial Deploys:**
- Hosting only: `firebase deploy --only hosting`
- Functions only: `firebase deploy --only functions`
- Security Rules only: `firebase deploy --only firestore:rules`
