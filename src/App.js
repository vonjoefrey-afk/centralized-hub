import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginForm from './components/LoginForm';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './components/dashboards/AdminDashboard';
import TeamLeaderDashboard from './components/dashboards/TeamLeaderDashboard';
import TeamMemberDashboard from './components/dashboards/TeamMemberDashboard';
import { USER_ROLES } from './firebase/auth';
import './index.css';

// Component to redirect users to their appropriate dashboard
const DashboardRedirect = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

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
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginForm />} />
            
            {/* Protected routes */}
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
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
