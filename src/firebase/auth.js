/**
 * Firebase Authentication Service
 * 
 * This file handles all authentication-related operations for the Team Management App.
 * It provides functions for:
 * - User sign up and sign in
 * - User sign out
 * - Authentication state monitoring
 * - User role management
 * - User data synchronization between Firebase Auth and Firestore
 * 
 * The authentication system works with three user roles:
 * - ADMIN: Full system access, can manage all users and teams
 * - TEAM_LEADER: Can create teams and manage team updates (requires admin approval)
 * - TEAM_MEMBER: Can view and acknowledge team updates (auto-approved)
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from './config';
import { getUserByEmail, reactivateRejectedUser } from '../services/users';
import { logger } from '../utils/logger';

/**
 * Authentication State Callback Storage
 * 
 * This variable stores the callback function for manual authentication state changes.
 * It's used to trigger authentication state updates when needed, especially after
 * user sign up or when the automatic onAuthStateChanged doesn't fire immediately.
 */
let authStateCallback = null;

/**
 * User Roles Constants
 * 
 * Defines the four user roles available in the system:
 * 
 * - ADMIN: System administrators with full access
 *   - Can manage all users (view, edit roles, delete)
 *   - Can approve/reject team leader requests
 *   - Can access system settings and analytics
 * 
 * - TRAINER: Trainers who can send updates to all teams
 *   - Requires admin approval before access
 * 
 * - TEAM_LEADER: Team leaders who manage teams and updates
 *   - Can create and manage teams
 *   - Can create updates for team acknowledgment
 *   - Can manage team members
 *   - Requires admin approval before access
 * 
 * - TEAM_MEMBER: Regular team members
 *   - Can view team updates
 *   - Can acknowledge updates
 *   - Can access team tools and templates
 *   - Auto-approved upon registration
 */
export const USER_ROLES = {
  ADMIN: 'admin',
  TRAINER: 'trainer',
  TEAM_LEADER: 'team_leader',
  TEAM_MEMBER: 'team_member'
};

/**
 * Build a consistent user data object from Firebase Auth user + Firestore document data.
 * Used internally to avoid duplicating this mapping in signIn, onAuthStateChange, and
 * triggerAuthStateChange.
 *
 * @param {Object} authUser - Firebase Auth user object
 * @param {Object} docData  - Firestore user document data
 * @returns {Object} Normalised user data object
 */
const buildUserData = (authUser, docData) => ({
  uid: authUser.uid,
  email: authUser.email,
  role: docData.role || USER_ROLES.TEAM_MEMBER,
  isCoAdmin: docData.isCoAdmin || false,
  displayName: docData.displayName,
  teamId: docData.teamId,
  isApproved: docData.isApproved,
  pendingApproval: docData.pendingApproval,
  status: docData.status || 'active',
  ssoMigrated: docData.ssoMigrated || false,
  features: docData.features || null,
  providerData: authUser.providerData
});

/**
 * Sign In Function
 * 
 * Authenticates a user with email and password, then retrieves their profile data from Firestore.
 * This function handles the complete sign-in process including:
 * 
 * 1. Firebase Authentication (email/password verification)
 * 2. Firestore user document retrieval
 * 3. User data validation and formatting
 * 4. Error handling for deleted/invalid accounts
 * 
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Promise<Object>} User data object with role, approval status, etc.
 * @throws {Error} If authentication fails or user account is deleted
 */
export const signIn = async (email, password) => {
  try {
    logger.debug('Firebase signIn called with email:', email);

    // Step 1: Authenticate with Firebase using email and password
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    logger.debug('Firebase auth successful, user ID:', user.uid);

    // Step 2: Retrieve user's profile data from Firestore
    // The user document contains role, approval status, team info, etc.
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    logger.debug('User document exists:', userDoc.exists());

    if (userDoc.exists()) {
      // Step 3: Format and return user data for the application
      const userDocData = userDoc.data();

      // Admin RBAC Check: Due to the 100% Google SSO transition, ONLY Admins can use literal dummy emails/passwords
      // Standard members are aggressively ejected if they attempt to bypass SSO, UNLESS they are QA Testing accounts.
      const QA_DOMAINS = ['@dummy.com', '@test.com'];
      const isQAAccount = QA_DOMAINS.some(domain => user.email.toLowerCase().endsWith(domain));

      if (userDocData.role !== USER_ROLES.ADMIN && !isQAAccount) {
        logger.warn('Non-Admin attempted to use legacy email/password backdoor. Ejecting.');
        await signOut(auth);
        throw new Error('Access denied. Administrator privileges required for direct authentication.');
      }

      const userData = buildUserData(user, userDocData);
      logger.debug('signIn: Returning user data, role:', userDocData.role);
      return userData;
    }

    // Step 4: Handle case where user document doesn't exist
    // This happens when a user was deleted from Firestore but still exists in Firebase Auth
    logger.warn('User document does not exist - user may have been deleted');

    // Sign out the user from Firebase Auth since their Firestore document is gone
    await signOut(auth);

    // Throw a specific error for deleted users so the UI can show appropriate message
    const error = new Error('Account not found. This account may have been deleted by an administrator.');
    error.code = 'user-deleted';
    throw error;
  } catch (error) {
    logger.error('Sign in error:', error);
    throw error;
  }
};

/**
 * Sign Up Function
 * 
 * Creates a new user account with email and password, then creates their profile in Firestore.
 * This function handles the complete registration process including:
 * 
 * 1. Firebase Authentication account creation
 * 2. Firestore user document creation with role and approval status
 * 3. Role-based approval logic (team members auto-approved, team leaders need approval)
 * 4. User data formatting and return
 * 
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @param {string} displayName - User's display name
 * @param {string} role - User's role (defaults to TEAM_MEMBER)
 * @returns {Promise<Object>} User data object with role, approval status, etc.
 * @throws {Error} If account creation fails
 */
export const signUp = async (email, password, displayName, role = USER_ROLES.TEAM_MEMBER) => {
  try {
    logger.debug('Firebase signUp called with email and role:', email, role);

    // Step 1: Create user account in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    logger.debug('Firebase user created, ID:', user.uid);

    // Step 2: Create user profile document in Firestore
    // This document stores additional user data not available in Firebase Auth
    const userData = {
      email: user.email,                    // User's email address
      displayName,                          // User's display name
      role,                                 // User's role (admin, team_leader, team_member)
      createdAt: new Date(),               // Account creation timestamp
      teamId: null,                        // Team ID (null initially, assigned later)
      isApproved: role === USER_ROLES.TEAM_MEMBER, // Auto-approve team members
      pendingApproval: [USER_ROLES.TEAM_LEADER, USER_ROLES.TRAINER].includes(role), // Trainer and Team Leader need admin approval
      status: 'active',                     // User status
      features: {
        updates: true,
        gcpBilling: true,
        templates: true,
        notes: true,
        metrics: true,
        spiiCases: false,
        spiiCasePoc: false,
        spiiAudit: true
      }
    };

    logger.debug('Creating user document with role:', role);
    await setDoc(doc(db, 'users', user.uid), userData);
    logger.debug('User document created successfully');

    // Step 3: Format and return user data for the application
    const result = {
      uid: user.uid,                    // Firebase Auth user ID
      email: user.email,                // User's email address
      role,                             // User's role
      displayName,                      // User's display name
      teamId: null,                     // Team ID (null initially)
      isApproved: userData.isApproved,  // Whether user is approved
      pendingApproval: userData.pendingApproval, // Whether user needs approval
      features: userData.features
    };
    logger.debug('SignUp returning user data');
    return result;
  } catch (error) {
    logger.error('Sign up error:', error);
    throw error;
  }
};

/**
 * Sign Out Function
 * 
 * Signs out the current user from Firebase Authentication.
 * This clears the user's session and removes their authentication state.
 * 
 * @throws {Error} If sign out fails
 */
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};

/**
 * Authentication State Change Listener
 * 
 * Sets up a real-time listener for authentication state changes.
 * This function is called when the app starts to monitor user login/logout events.
 * 
 * When a user signs in or out, this listener:
 * 1. Detects the authentication state change
 * 2. Fetches the user's profile data from Firestore
 * 3. Calls the provided callback with the complete user data
 * 4. Handles errors gracefully by calling callback with null
 * 
 * @param {Function} callback - Function to call when auth state changes
 * @returns {Function} Unsubscribe function to stop listening
 */
export const onAuthStateChange = (callback) => {
  logger.debug('onAuthStateChange: Setting up listener with callback');
  authStateCallback = callback; // Store callback for manual triggering

  // Set up Firebase authentication state listener
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    logger.debug('onAuthStateChange: Firebase auth state changed', user ? `user: ${user.uid}` : 'no user');

    if (user) {
      try {
        // User is authenticated - fetch their profile data from Firestore
        logger.debug('onAuthStateChange: Fetching user document for UID:', user.uid);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        logger.debug('onAuthStateChange: User document exists:', userDoc.exists());

        if (userDoc.exists()) {
          // User document exists - format and return complete user data
          const userDocData = userDoc.data();
          const userData = buildUserData(user, userDocData);
          logger.debug('onAuthStateChange: Calling callback with user data, role:', userDocData.role);
          callback(userData);
        } else {
          // User document doesn't exist - user was deleted
          logger.warn('onAuthStateChange: User document does not exist, calling callback with null');
          callback(null);
        }
      } catch (error) {
        // Error fetching user data - treat as not authenticated
        logger.error('onAuthStateChange: Error fetching user data:', error);
        callback(null);
      }
    } else {
      // No user authenticated
      logger.debug('onAuthStateChange: No user, calling callback with null');
      callback(null);
    }
  });

  return unsubscribe;
};

/**
 * Manual Authentication State Change Trigger
 * 
 * Manually triggers the authentication state change callback.
 * This is used when the automatic onAuthStateChanged listener doesn't fire immediately,
 * which can happen after user sign up or in certain edge cases.
 * 
 * This function:
 * 1. Checks if there's a stored callback and a current user
 * 2. Fetches the user's profile data from Firestore
 * 3. Calls the callback with the complete user data
 * 
 * This ensures the UI updates properly even when the automatic listener fails.
 */
export const triggerAuthStateChange = async () => {
  logger.debug('triggerAuthStateChange: Manually triggering auth state change');
  if (authStateCallback) {
    const user = auth.currentUser;
    if (user) {
      try {
        // Fetch user profile data from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          // Format and return complete user data
          const userDocData = userDoc.data();
          const userData = buildUserData(user, userDocData);
          logger.debug('triggerAuthStateChange: Manually calling callback with user data, role:', userDocData.role);
          authStateCallback(userData);
        } else {
          logger.warn('triggerAuthStateChange: User document does not exist, calling callback with null');
          authStateCallback(null);
        }
      } catch (error) {
        logger.error('triggerAuthStateChange: Error:', error);
        authStateCallback(null);
      }
    } else {
      logger.debug('triggerAuthStateChange: No current user, calling callback with null');
      authStateCallback(null);
    }
  } else {
    logger.debug('triggerAuthStateChange: No auth state callback available');
  }
};

/**
 * Delete Current User from Firebase Authentication
 * 
 * This function allows the current user to delete their own account.
 * This is useful for rejected team leaders who want to reuse their email.
 * 
 * @throws {Error} If deletion fails or user is not authenticated
 */
export const deleteCurrentUser = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }

    logger.debug('Deleting current user from Firebase Auth:', user.uid);

    // Delete the user from Firebase Authentication
    await deleteUser(user);

    logger.debug('User deleted successfully from Firebase Auth');
    return { success: true, message: 'Account deleted successfully. You can now sign up with the same email.' };
  } catch (error) {
    logger.error('Error deleting current user:', error);

    // Handle specific error cases
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('For security reasons, please sign in again before deleting your account.');
    }

    throw error;
  }
};

/**
 * Change User Password
 * 
 * Allows the current authenticated user to change their own password.
 * This requires the user to provide their current password for security.
 * 
 * @param {string} currentPassword - The user's current password
 * @param {string} newPassword - The new password to set
 * @returns {Promise<Object>} Success status and message
 * @throws {Error} If password change fails
 */
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error('No user is currently signed in');
    }

    // Create credential for re-authentication
    const credential = EmailAuthProvider.credential(user.email, currentPassword);

    // Re-authenticate the user (required by Firebase for security)
    await reauthenticateWithCredential(user, credential);

    // Now update the password
    await updatePassword(user, newPassword);

    return {
      success: true,
      message: 'Password changed successfully!'
    };
  } catch (error) {
    logger.error('Error changing password:', error);

    // Handle specific error cases
    if (error.code === 'auth/wrong-password') {
      throw new Error('Current password is incorrect');
    }
    if (error.code === 'auth/weak-password') {
      throw new Error('New password is too weak. Please use a stronger password.');
    }
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('For security reasons, please sign out and sign in again before changing your password.');
    }
    if (error.code === 'auth/invalid-credential') {
      throw new Error('Current password is incorrect');
    }

    throw new Error(error.message || 'Failed to change password');
  }
};

/**
 * Generate a secure temporary password
 * 
 * Generates a random, secure password that meets Firebase requirements:
 * - At least 6 characters long
 * - Contains uppercase, lowercase, numbers, and special characters
 * 
 * @returns {string} A secure temporary password
 */
export const generateTemporaryPassword = () => {
  const length = 12;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;

  // Ensure at least one character from each set
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Reset User Password (Admin Function)
 * 
 * Resets a user's password to a temporary password generated by the system.
 * This function requires Admin SDK privileges, so it should be called via a Cloud Function.
 * 
 * IMPORTANT: To actually reset the password in Firebase Auth, you need to deploy the Cloud Function.
 * See functions/resetUserPassword.js for the Cloud Function implementation.
 * 
 * Without the Cloud Function:
 * - A temporary password will be generated and displayed to the admin
 * - The password will NOT be changed in Firebase Auth
 * - The admin must manually provide the password to the user
 * 
 * With the Cloud Function deployed:
 * - The password will be automatically reset in Firebase Auth
 * - The user can immediately use the temporary password to log in
 * 
 * To deploy the Cloud Function:
 * 1. Set REACT_APP_FUNCTIONS_URL in your .env file
 * 2. Deploy: firebase deploy --only functions
 * 
 * @param {string} userId - The UID of the user whose password should be reset
 * @returns {Promise<Object>} Object containing the temporary password and success status
 * @throws {Error} If reset fails or user is not found
 */
export const resetUserPassword = async (userId) => {
  try {
    // Generate a secure temporary password
    const tempPassword = generateTemporaryPassword();

    // Get user data
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    // Try to call Cloud Function if available
    // The Cloud Function will handle storing the password reset record in Firestore
    // The function URL should be the full URL: https://REGION-PROJECT.cloudfunctions.net/resetUserPassword
    // Deployed to asia-southeast1 (Singapore) for better performance in Asia
    const functionsUrl = import.meta.env.REACT_APP_FUNCTIONS_URL || 'https://asia-southeast1-centralized-gcp.cloudfunctions.net/resetUserPassword';

    if (functionsUrl) {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
          throw new Error('User not authenticated. Please log in again.');
        }

        const response = await fetch(functionsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            userId: userId,
            tempPassword: tempPassword
          })
        });

        if (response.ok) {
          const result = await response.json();
          return {
            success: true,
            temporaryPassword: tempPassword,
            userEmail: userData.email,
            userName: userData.displayName,
            message: 'Password reset successful. The user can now log in with the temporary password.',
            passwordResetInAuth: true
          };
        } else {
          // Get error details from response
          let errorMessage = `Cloud Function returned error: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            // If response is not JSON, use status text
            const text = await response.text();
            if (text) errorMessage = text;
          }

          logger.error('Cloud Function call failed:', errorMessage);
          throw new Error(errorMessage);
        }
      } catch (cfError) {
        logger.error('Cloud Function error:', cfError);
        // If it's a network error or the function doesn't exist, throw it
        if (cfError.message && (cfError.message.includes('Failed to fetch') || cfError.message.includes('NetworkError'))) {
          throw new Error('Unable to connect to Cloud Function. Please check your internet connection and ensure the function is deployed.');
        }
        // Re-throw the error so it's properly handled
        throw cfError;
      }
    }

    // Fallback: Return temporary password without actually resetting in Auth
    // NOTE: The password in Firebase Auth is NOT changed without the Cloud Function
    return {
      success: true,
      temporaryPassword: tempPassword,
      userEmail: userData.email,
      userName: userData.displayName,
      message: 'Temporary password generated. NOTE: To actually reset the password in Firebase Auth, deploy the Cloud Function. See functions/resetUserPassword.js',
      passwordResetInAuth: false
    };
  } catch (error) {
    logger.error('Error resetting user password:', error);
    throw error;
  }
};

/**
 * Delete user from Firebase Authentication
 * 
 * This function calls a Cloud Function to delete a user from Firebase Authentication.
 * Only admins can delete users, and the deletion is performed server-side using
 * Firebase Admin SDK for security.
 * 
 * @param {string} userId - The UID of the user to delete from Authentication
 * @returns {Promise<Object>} Success status and message
 * @throws {Error} If the deletion fails
 * 
 * Prerequisites:
 * 1. The Cloud Function must be deployed: functions/index.js -> deleteUserFromAuth
 * 2. The caller must be authenticated as an admin
 * 3. Set REACT_APP_FUNCTIONS_URL in your .env file (optional, has default)
 */
export const deleteUserFromAuth = async (userId) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated to delete users');
    }

    // Get the ID token for authentication
    const idToken = await currentUser.getIdToken();

    // The function URL should be the full URL: https://REGION-PROJECT.cloudfunctions.net/deleteUserFromAuth
    const functionsUrl = import.meta.env.REACT_APP_FUNCTIONS_URL?.replace('resetUserPassword', 'deleteUserFromAuth') ||
      'https://asia-southeast1-centralized-gcp.cloudfunctions.net/deleteUserFromAuth';

    if (functionsUrl) {
      try {
        // Use AbortController with 12-second timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        let response;
        try {
          response = await fetch(functionsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ userId }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.message || 'Failed to delete user from Authentication');
        }

        return {
          success: true,
          message: 'User deleted from Firebase Authentication successfully'
        };
      } catch (fetchError) {
        // AbortError means the 12s timeout was hit
        if (fetchError.name === 'AbortError') {
          throw new Error('Cloud Function timed out after 12 seconds. User data deleted from Firestore but Auth account may persist.');
        }
        logger.error('Error calling deleteUserFromAuth Cloud Function:', fetchError);
        throw new Error('Failed to delete user from Authentication: ' + fetchError.message);
      }
    } else {
      throw new Error('Cloud Function URL not configured. Set REACT_APP_FUNCTIONS_URL in your .env file.');
    }
  } catch (error) {
    logger.error('Error in deleteUserFromAuth:', error);
    throw error;
  }
};

/**
 * Sign in with Google
 * 
 * Authenticates the user using a Google account.
 * Only allows sign in if the email domain is @google.com.
 * 
 * @returns {Promise<Object>} The authenticated user data
 */
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Fetch the user's profile from Firestore first to perform Role-Based Access Control
    const userDoc = await getDoc(doc(db, 'users', user.uid));

    // Domain & Role check
    const isGoogleDomain = user.email.toLowerCase().endsWith('@google.com');
    const isAdmin = userDoc.exists() && userDoc.data().role === USER_ROLES.ADMIN;

    if (!isGoogleDomain && !isAdmin) {
      // Sign out and throw error if domain is incorrect and they aren't an admin bypass
      await signOut(auth);
      throw new Error('Access denied. Only @google.com accounts or authorized administrators are allowed.');
    }

    if (!userDoc.exists()) {
      // Manual "Add User": if an admin pre-provisioned this email, claim that
      // invite now — the user is created with the admin-assigned role/team and is
      // auto-approved (no pending-approval step), then the invite is consumed.
      try {
        const emailLower = user.email.toLowerCase();
        const provRef = doc(db, 'provisioned_users', emailLower);
        const provSnap = await getDoc(provRef);
        if (provSnap.exists()) {
          const prov = provSnap.data();
          const provisionedData = {
            email: user.email,
            ssoEmail: prov.ssoEmail || user.email,
            displayName: prov.displayName || user.displayName || user.email.split('@')[0],
            role: prov.role || USER_ROLES.TEAM_MEMBER,
            teamId: prov.teamId || null,
            isCoAdmin: false,
            isApproved: true,
            pendingApproval: false,
            status: 'active',
            createdAt: prov.createdAt || new Date(),
            manuallyAdded: true,
            ssoMigrated: true,
            features: prov.features || {
              updates: true, gcpBilling: true, templates: true, notes: true, metrics: true, spiiCases: false, spiiCasePoc: false, appsScript: false,
            },
          };
          await setDoc(doc(db, 'users', user.uid), provisionedData);

          // Best-effort: add to the assigned team's member list.
          if (prov.teamId) {
            try {
              const teamRef = doc(db, 'teams', prov.teamId);
              const teamSnap = await getDoc(teamRef);
              if (teamSnap.exists()) {
                const members = teamSnap.data().members || [];
                if (!members.includes(user.uid)) {
                  await updateDoc(teamRef, { members: [...members, user.uid] });
                }
              }
            } catch (teamErr) {
              logger.warn('Could not add provisioned user to team members:', teamErr);
            }
          }

          // Consume the invite so it cannot be reused.
          try { await deleteDoc(provRef); } catch (delErr) { logger.warn('Could not delete consumed invite:', delErr); }

          logger.info('Provisioned user claimed invite on first login:', user.email);
          await triggerAuthStateChange();
          return { success: true, user };
        }
      } catch (provError) {
        logger.warn('Provisioned-invite check failed; continuing normal sign-in flow:', provError);
      }

      // SSO Migration Logic: Check if a user with this email already exists under a different UID
      try {
        const existingUser = await getUserByEmail(user.email);
        if (existingUser && existingUser.id !== user.uid) {
          logger.info(`Migrating existing user data from ${existingUser.id} to new SSO UID ${user.uid}`);
          
          // 1. Copy user document to the new UID
          const migratedData = {
            ...existingUser,
            ssoMigrated: true,
            updatedAt: new Date()
          };
          delete migratedData.id; // Remove the old ID from the data object
          
          await setDoc(doc(db, 'users', user.uid), migratedData);
          
          // 2. Update Team References
          // If the user was a Team Leader, update their team's teamLeaderId
          if (existingUser.role === USER_ROLES.TEAM_LEADER) {
            const teamsQuery = query(collection(db, 'teams'), where('teamLeaderId', '==', existingUser.id));
            const teamsSnapshot = await getDocs(teamsQuery);
            if (!teamsSnapshot.empty) {
              const batch = writeBatch(db);
              teamsSnapshot.forEach(teamDoc => {
                batch.update(teamDoc.ref, { teamLeaderId: user.uid });
              });
              await batch.commit();
              logger.debug(`Updated teamLeaderId for ${teamsSnapshot.size} teams`);
            }
          }
          
          // 3. Update Team Membership (Members array)
          if (existingUser.teamId) {
            const teamDocRef = doc(db, 'teams', existingUser.teamId);
            const teamSnapshot = await getDoc(teamDocRef);
            if (teamSnapshot.exists()) {
              const members = teamSnapshot.data().members || [];
              if (members.includes(existingUser.id)) {
                const updatedMembers = members.map(m => m === existingUser.id ? user.uid : m);
                await updateDoc(teamDocRef, { members: updatedMembers });
                logger.debug(`Updated membership UID in team ${existingUser.teamId}`);
              }
            }
          }

          // 4. Update Business Data (SPII Cases & Tracked Cases)
          const collectionsToMigrate = ['spii_cases', 'tracked_cases', 'acknowledgments', 'notifications'];
          for (const collName of collectionsToMigrate) {
            try {
              const q = query(collection(db, collName), where('userId', '==', existingUser.id));
              const snap = await getDocs(q);
              if (!snap.empty) {
                const batch = writeBatch(db);
                snap.forEach(d => {
                  batch.update(d.ref, { userId: user.uid });
                });
                await batch.commit();
                logger.debug(`Migrated ${snap.size} records from ${collName}`);
              }
            } catch (err) {
              logger.warn(`Failed to migrate ${collName}:`, err);
            }
          }

          // 5. Delete the old Firestore record
          await deleteDoc(doc(db, 'users', existingUser.id));
          logger.info('Migration complete: Old Firestore record deleted');
        } else {
          // Normal Flow: Create new user document
          const userData = {
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            role: USER_ROLES.TEAM_MEMBER,
            createdAt: new Date(),
            teamId: null,
            isApproved: true,
            pendingApproval: false,
            status: 'active',
            ssoMigrated: true,
            features: {
              updates: true,
              gcpBilling: true,
              templates: true,
              notes: true,
              metrics: true,
              spiiCases: false,
              spiiCasePoc: false,
              appsScript: false
            }
          };
          await setDoc(doc(db, 'users', user.uid), userData);
          logger.debug('New SSO user document created');
        }
      } catch (migrationError) {
        logger.error('Error during SSO UID migration:', migrationError);
        // Fallback: create a basic doc if migration fails so they can at least log in
        if (!userDoc.exists()) {
           await setDoc(doc(db, 'users', user.uid), {
             email: user.email,
             displayName: user.displayName || user.email.split('@')[0],
             role: USER_ROLES.TEAM_MEMBER,
             createdAt: new Date(),
             teamId: null,
             isApproved: true,
             pendingApproval: false,
             status: 'active',
             ssoMigrated: true,
             features: null
           });
        }
      }
    }

    // After successful sign-in, trigger auth state change to fetch Firestore data
    await triggerAuthStateChange();

    return {
      success: true,
      user
    };
  } catch (error) {
    logger.error('Error signing in with Google:', error);
    throw error;
  }
};
