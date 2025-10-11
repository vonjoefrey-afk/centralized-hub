import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your Firebase configuration
// Replace with your actual Firebase config from Firebase Console > Project Settings > Your apps
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

// Example config (replace with yours):
// const firebaseConfig = {
//   apiKey: "AIzaSyC...",
//   authDomain: "team-management-app.firebaseapp.com",
//   projectId: "team-management-app",
//   storageBucket: "team-management-app.appspot.com",
//   messagingSenderId: "123456789012",
//   appId: "1:123456789012:web:abc123def456"
// };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;
