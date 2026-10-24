/**
 * Protected Route Component
 * 
 * This component provides role-based access control for protected routes.
 * It ensures that only authenticated users with the correct role can access
 * specific parts of the application.
 * 
 * The component works by:
 * 1. Checking if a user is authenticated
 * 2. Verifying the user has the required role for the route
 * 3. Redirecting to appropriate dashboard if role doesn't match
 * 4. Rendering the protected content if access is granted
 * 
 * This prevents unauthorized access and provides a seamless user experience
 * by automatically redirecting users to their appropriate dashboard.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { USER_ROLES } from '../firebase/auth';
import { logger } from '../utils/logger';

/**
 * ProtectedRoute Component
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - The content to render if access is granted
 * @param {string} props.requiredRole - The role required to access this route
 * @returns {JSX.Element} Either the protected content or a redirect component
 */
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user } = useAuth();

  logger.debug('ProtectedRoute: Checking access', { hasUser: !!user, userRole: user?.role, requiredRole });

  // Step 1: Check if user is authenticated
  if (!user) {
    logger.debug('ProtectedRoute: No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Step 2: Check if user has the required role (if specified)
  // HOTFIX for Co-Admin Feature: If the route strictly requires ADMIN, but the user inherently has `isCoAdmin === true`
  // on their context, we explicitly bypass the block!
  const hasCoAdminBypass = requiredRole === USER_ROLES.ADMIN && user.isCoAdmin === true;

  if (requiredRole && user.role !== requiredRole && !hasCoAdminBypass) {
    logger.debug('ProtectedRoute: Role mismatch', { userRole: user.role, requiredRole });
    
    // Redirect to appropriate dashboard based on user's actual role
    switch (user.role) {
      case USER_ROLES.ADMIN:
        logger.debug('ProtectedRoute: Redirecting to admin dashboard');
        return <Navigate to="/admin" replace />;
      case USER_ROLES.TRAINER:
        logger.debug('ProtectedRoute: Redirecting to trainer dashboard');
        return <Navigate to="/trainer" replace />;
      case USER_ROLES.TEAM_LEADER:
        logger.debug('ProtectedRoute: Redirecting to team leader dashboard');
        return <Navigate to="/team-leader" replace />;
      case USER_ROLES.TEAM_MEMBER:
        logger.debug('ProtectedRoute: Redirecting to team member dashboard');
        return <Navigate to="/team-member" replace />;
      default:
        logger.warn('ProtectedRoute: Unknown role, redirecting to login', user.role);
        return <Navigate to="/login" replace />;
    }
  }

  // Step 3: Access granted - render the protected content
  logger.debug('ProtectedRoute: Access granted, rendering children');
  return children;
};

export default ProtectedRoute;
