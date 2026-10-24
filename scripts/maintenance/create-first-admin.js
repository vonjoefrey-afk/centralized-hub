/**
 * Create First Admin User
 * 
 * Instructions:
 * 1. Open your app at https://centralized-gcp.web.app
 * 2. Open browser console (F12 or Cmd+Option+I)
 * 3. Copy and paste the code below into the console
 * 4. Replace the email and password with your desired admin credentials
 * 5. Press Enter to execute
 */

// Import Firebase functions (these are available in the browser)
// First, we need to access the Firebase app instance
// Since the app is already loaded, we can use the window object or import from the module

// Method: Use the signUp function directly
// Copy this entire block and paste into browser console:

(async () => {
  try {
    // Import the signUp function (adjust path if needed)
    const { signUp, USER_ROLES } = await import('./src/firebase/auth.js');
    
    // Replace these with your desired admin credentials
    const adminEmail = 'admin@yourcompany.com';
    const adminPassword = 'YourSecurePassword123!';
    const adminName = 'Admin User';
    
    console.log('Creating admin user...');
    const result = await signUp(adminEmail, adminPassword, adminName, USER_ROLES.ADMIN);
    console.log('✅ Admin user created successfully!', result);
    console.log('You can now log in with:', adminEmail);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
  }
})();

// Alternative: If the import doesn't work, use this direct method:
// (This assumes Firebase is already initialized in your app)

/*
// Direct method using Firebase SDK (paste this in console):
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { auth, db } from './src/firebase/config.js';

const adminEmail = 'admin@yourcompany.com';
const adminPassword = 'YourSecurePassword123!';
const adminName = 'Admin User';

createUserWithEmailAndPassword(auth, adminEmail, adminPassword)
  .then(async (userCredential) => {
    const user = userCredential.user;
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      displayName: adminName,
      role: 'admin',
      createdAt: new Date(),
      teamId: null,
      isApproved: true,
      pendingApproval: false,
      status: 'active'
    });
    console.log('✅ Admin user created!', user.uid);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
  });
*/

