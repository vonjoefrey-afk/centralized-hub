/**
 * Main App Component - Team Management Application
 * 
 * This is the root component that sets up the entire application structure including:
 * - Authentication context provider
 * - React Router for navigation
 * - Role-based route protection
 * - Dashboard redirection based on user roles
 * 
 * The app supports four user roles:
 * - Admin: Full system access and user management
 * - Trainer: Can send updates to all teams
 * - Team Leader: Can create teams and manage team updates
 * - Team Member: Can view and acknowledge team updates
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import LoginForm from './components/LoginForm';
import SudoLogin from './components/SudoLogin';
import PendingApproval from './components/PendingApproval';
import ProtectedRoute from './components/ProtectedRoute';
import FeedbackButton from './components/common/FeedbackButton';
import ActivityTracker from './components/ActivityTracker';
// Lazy-loaded so Mermaid (large) only downloads when someone opens /docs.
const DocsPage = lazy(() => import('./components/Documentation/DocsPage'));
import AdminDashboard from './components/dashboards/AdminDashboard';
import TrainerDashboard from './components/dashboards/TrainerDashboard';
import TeamLeaderDashboard from './components/dashboards/TeamLeaderDashboard';
import TeamMemberDashboard from './components/dashboards/TeamMemberDashboard';
import { USER_ROLES } from './firebase/auth';
import { logger } from './utils/logger';
import { resumeAudioContext } from './utils/audio';
import './index.css';

/**
 * DashboardRedirect Component
 * 
 * This component automatically redirects authenticated users to their appropriate dashboard
 * based on their role and approval status. It acts as a smart router that:
 * 
 * 1. Checks if user is authenticated
 * 2. Verifies if user needs admin approval (for team leaders)
 * 3. Redirects to the correct dashboard based on user role
 * 4. Falls back to login if user has invalid/unknown role
 * 
 * This prevents users from accessing dashboards they shouldn't see and provides
 * a seamless user experience by automatically routing them to the right place.
 */
const DashboardRedirect = () => {
  const { user } = useAuth();

  logger.debug('DashboardRedirect: Current user', user ? `role: ${user.role}` : 'no user');

  // If no user is authenticated, redirect to login page
  if (!user) {
    logger.debug('DashboardRedirect: No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Check if user is a team leader waiting for admin approval or rejected
  // Team leaders need admin approval before they can access their dashboard
  if (user.pendingApproval && !user.isApproved) {
    logger.debug('DashboardRedirect: User pending approval, showing pending page');
    return <Navigate to="/pending-approval" replace />;
  }
  
  // Check if user is rejected
  if (user.status === 'rejected') {
    logger.debug('DashboardRedirect: User rejected, showing pending page');
    return <Navigate to="/pending-approval" replace />;
  }

  logger.debug('DashboardRedirect: User role:', user.role);
  
  // Route users to their appropriate dashboard based on their role
  switch (user.role) {
    case USER_ROLES.ADMIN:
      logger.debug('DashboardRedirect: Redirecting to admin dashboard');
      return <Navigate to="/admin" replace />;
    case USER_ROLES.TRAINER:
      logger.debug('DashboardRedirect: Redirecting to trainer dashboard');
      return <Navigate to="/trainer" replace />;
    case USER_ROLES.TEAM_LEADER:
      logger.debug('DashboardRedirect: Redirecting to team leader dashboard');
      return <Navigate to="/team-leader" replace />;
    case USER_ROLES.TEAM_MEMBER:
      logger.debug('DashboardRedirect: Redirecting to team member dashboard');
      return <Navigate to="/team-member" replace />;
    default:
      // Unknown role - redirect to login for security
      logger.warn('DashboardRedirect: Unknown role, redirecting to login', user.role);
      return <Navigate to="/login" replace />;
  }
};

/**
 * Main App Function
 * 
 * This function renders the entire application with the following structure:
 * 
 * 1. AuthProvider: Provides authentication context to all child components
 * 2. Router: Enables client-side routing with React Router
 * 3. Routes: Defines all application routes with proper protection
 * 
 * Route Structure:
 * - Public routes: Login and pending approval (no authentication required)
 * - Protected routes: All dashboards require specific user roles
 * - Root route: Smart redirect based on user role and status
 * - Catch-all: Redirects unknown routes to root for proper handling
 */
function App() {
  React.useEffect(() => {
    logger.debug('App: Component mounted');
    
    // Resume audio context on first user interaction to bypass browser autoplay policies
    const resumeAudio = () => {
      resumeAudioContext().then(() => {
        logger.debug('Audio context successfully primed/resumed');
        window.removeEventListener('click', resumeAudio);
        window.removeEventListener('keydown', resumeAudio);
      }).catch(err => {
        logger.warn('Failed to resume audio context on interaction:', err);
      });
    };
    
    window.addEventListener('click', resumeAudio);
    window.addEventListener('keydown', resumeAudio);

    return () => {
      logger.debug('App: Component UNMOUNTED');
      window.removeEventListener('click', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <div className="App min-h-screen bg-gray-50 dark:bg-[#050505] transition-colors duration-300">
              <Routes>
            {/* 
              PUBLIC ROUTES - No authentication required
              These routes are accessible to anyone, including unauthenticated users
            */}
            <Route path="/login" element={<LoginForm />} />
            <Route path="/sudo-access" element={<SudoLogin />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route
              path="/docs"
              element={
                <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-[#050505]" />}>
                  <DocsPage />
                </Suspense>
              }
            />
            
            {/* 
              PROTECTED ROUTES - Require specific user roles
              These routes are protected by the ProtectedRoute component which:
              - Checks if user is authenticated
              - Verifies user has the required role
              - Redirects to appropriate dashboard if role doesn't match
            */}
            <Route path="/" element={<DashboardRedirect />} />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requiredRole={USER_ROLES.ADMIN}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/trainer" 
              element={
                <ProtectedRoute requiredRole={USER_ROLES.TRAINER}>
                  <TrainerDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/team-leader" 
              element={
                <ProtectedRoute requiredRole={USER_ROLES.TEAM_LEADER}>
                  <TeamLeaderDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/team-member" 
              element={
                <ProtectedRoute requiredRole={USER_ROLES.TEAM_MEMBER}>
                  <TeamMemberDashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* 
              CATCH-ALL ROUTE - Handles unknown URLs
              Any URL that doesn't match the above routes will redirect to root
              This ensures users always land on a valid page
            */}
              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <FeedbackButton />
              <ActivityTracker />
            </div>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
