import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { USER_ROLES } from '../firebase/auth';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // Redirect to appropriate dashboard based on user role
    switch (user.role) {
      case USER_ROLES.ADMIN:
        return <Navigate to="/admin" replace />;
      case USER_ROLES.TEAM_LEADER:
        return <Navigate to="/team-leader" replace />;
      case USER_ROLES.TEAM_MEMBER:
        return <Navigate to="/team-member" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
