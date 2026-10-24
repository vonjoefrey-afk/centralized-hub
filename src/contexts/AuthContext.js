/**
 * Authentication Context
 * 
 * This file provides authentication state management for the entire application.
 * It uses React Context to share authentication data across all components without
 * prop drilling. The context includes:
 * 
 * - User authentication state (logged in/out)
 * - User profile data (role, team, approval status)
 * - Loading state during authentication checks
 * - Real-time authentication state monitoring
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChange } from '../firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logger } from '../utils/logger';

/**
 * Authentication Context
 * 
 * Creates a React Context for sharing authentication state across the application.
 * This context will contain the current user data and loading state.
 */
const AuthContext = createContext();

/**
 * useAuth Hook
 * 
 * Custom hook that provides easy access to the authentication context.
 * This hook must be used within an AuthProvider, otherwise it will throw an error.
 * 
 * @returns {Object} Authentication context containing user data and loading state
 * @throws {Error} If used outside of AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * AuthProvider Component
 * 
 * This component provides authentication state to all child components.
 * It manages:
 * 
 * 1. User authentication state (null = not logged in, object = logged in)
 * 2. Loading state during authentication checks
 * 3. Real-time authentication state monitoring
 * 4. Automatic cleanup of authentication listeners
 * 
 * The provider wraps the entire application and ensures all components
 * have access to the current user's authentication status and profile data.
 * 
 * @param {Object} props - React props
 * @param {React.ReactNode} props.children - Child components to wrap
 * @returns {JSX.Element} AuthProvider component
 */
export const AuthProvider = ({ children }) => {
  // State for current user (null if not authenticated, user object if authenticated)
  const [user, setUser] = useState(null);

  // State for loading indicator (true while checking authentication status)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logger.debug('AuthProvider: Setting up auth state listener');

    let unsubscribeDoc = null;

    // Set up real-time authentication state listener
    const unsubscribeAuth = onAuthStateChange((authUser) => {
      logger.debug('AuthContext: Auth state changed:', authUser ? 'user authenticated' : 'no user');

      // Clean up previous document listener if it exists
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (authUser) {
        logger.debug('AuthContext: Setting up real-time user document listener for:', authUser.uid);

        // Set up real-time listener for the user's Firestore document
        // This ensures that feature flags and profile changes are reflected instantly
        unsubscribeDoc = onSnapshot(doc(db, 'users', authUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const userData = {
              uid: authUser.uid,
              email: authUser.email,
              ...docSnap.data()
            };
            logger.debug('AuthContext: User document updated in real-time');
            setUser(userData);
          } else {
            logger.warn('AuthContext: User document not found via snapshot');
            setUser(null);
          }
          setLoading(false);
        }, (error) => {
          logger.error('AuthContext: User document snapshot error:', error);
          // Fallback to authUser if snapshot fails but auth is still valid
          setUser(authUser);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Cleanup function
    return () => {
      logger.debug('AuthProvider: Cleaning up listeners');
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  // Value object to provide to all consuming components
  const value = {
    user,        // Current user data (null if not authenticated)
    loading      // Loading state (true while checking auth status)
  };

  logger.debug('AuthProvider: Rendering', { hasUser: !!user, loading });

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        // Show loading screen while checking authentication status
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      ) : (
        // Render child components once authentication check is complete
        children
      )}
    </AuthContext.Provider>
  );
};
