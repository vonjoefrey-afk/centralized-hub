/**
 * Firebase Configuration and Initialization
 * 
 * This file configures and initializes Firebase services for the Team Management App.
 * It sets up:
 * - Firebase Authentication (for user login/signup)
 * - Cloud Firestore (for database operations)
 * - Firebase App instance (base configuration)
 * 
 * SECURITY NOTE:
 * This configuration now uses environment variables for better security.
 * Make sure to create a .env file with your Firebase project values.
 * 
 * Required environment variables:
 * - REACT_APP_FIREBASE_API_KEY
 * - REACT_APP_FIREBASE_AUTH_DOMAIN
 * - REACT_APP_FIREBASE_PROJECT_ID
 * - REACT_APP_FIREBASE_STORAGE_BUCKET
 * - REACT_APP_FIREBASE_MESSAGING_SENDER_ID
 * - REACT_APP_FIREBASE_APP_ID
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase Configuration Object
 * 
 * This object contains all the necessary configuration to connect to Firebase.
 * Each field serves a specific purpose:
 * 
 * - apiKey: Public API key for Firebase (safe to expose in client-side code)
 * - authDomain: Domain for Firebase Authentication
 * - projectId: Unique identifier for your Firebase project
 * - storageBucket: URL for Firebase Storage (not used in this app)
 * - messagingSenderId: Sender ID for Firebase Cloud Messaging (not used)
 * - appId: Unique identifier for this Firebase app
 * 
 * SECURITY: Now using environment variables for better security!
 */
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

/**
 * Initialize Firebase App
 * 
 * Creates the main Firebase app instance using the configuration above.
 * This is the foundation for all other Firebase services.
 */
const app = initializeApp(firebaseConfig);

/**
 * Firebase Authentication Service
 * 
 * Provides authentication functionality including:
 * - User sign up and sign in
 * - Password management
 * - Authentication state monitoring
 * - User session management
 * 
 * This is used throughout the app to manage user authentication.
 */
export const auth = getAuth(app);

/**
 * Cloud Firestore Database Service
 * 
 * Provides database functionality including:
 * - Real-time data synchronization
 * - Document and collection management
 * - Query operations
 * - Offline support
 * 
 * This is used to store and retrieve:
 * - User profiles and roles
 * - Team information
 * - Updates and acknowledgments
 * - Notifications
 */
export const db = getFirestore(app);

/**
 * Default Export
 * 
 * Exports the main Firebase app instance for use in other parts of the application
 * if needed for additional Firebase services.
 */
export default app;
