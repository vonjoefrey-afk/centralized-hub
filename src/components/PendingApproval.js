/**
 * Pending Approval Component
 * 
 * This component is displayed to team leaders who have registered but are waiting
 * for admin approval. Team leaders require admin approval before they can access
 * their dashboard and create teams.
 * 
 * Features:
 * - Shows user's account details (name, email, role, status)
 * - Explains the approval process
 * - Provides sign out functionality
 * - Clean, informative UI with appropriate messaging
 * 
 * This component is accessed via the /pending-approval route and is shown
 * when a team leader tries to access the app before being approved.
 */

import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signOutUser, deleteCurrentUser } from '../firebase/auth';
import { deleteUserCompletely } from '../services/users';

/**
 * PendingApproval Component
 * 
 * @returns {JSX.Element} The pending approval page component
 */
const PendingApproval = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [countdown, setCountdown] = useState(30); // 30 seconds countdown
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Check if user is rejected
  const isRejected = user?.status === 'rejected';

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !isRedirecting) {
      handleAutoRedirect();
    }
  }, [countdown, isRedirecting]);

  // Auto-redirect function
  const handleAutoRedirect = async () => {
    setIsRedirecting(true);
    try {
      await signOutUser();
      navigate('/login');
    } catch (err) {
      logger.error('Auto redirect error:', err);
      // Force redirect even if sign out fails
      navigate('/login');
    }
  };

  /**
   * Handle Sign Out
   * 
   * Signs out the current user from the application.
   * This allows team leaders to sign out while waiting for approval.
   */
  const handleSignOut = async () => {
    try {
      await signOutUser();
      navigate('/login');
    } catch (err) {
      logger.error('Sign out error:', err);
      // Force redirect even if sign out fails
      navigate('/login');
    }
  };

  /**
   * Handle Account Deletion
   * 
   * Deletes the current user's account completely, allowing them to reuse their email.
   * This is useful for rejected team leaders who want to sign up again.
   */
  const handleDeleteAccount = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Delete from Firebase Auth
      await deleteCurrentUser();
      
      // Delete from Firestore (this will be handled by the auth state change)
      // The user will be automatically signed out and redirected to login
      
      setSuccess('Account deleted successfully. You can now sign up with the same email.');
      setShowDeleteModal(false);
      
      // Sign out the user
      setTimeout(() => {
        handleSignOut();
      }, 2000);
      
    } catch (err) {
      logger.error('Delete account error:', err);
      setError(err.message || 'Failed to delete account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center">
            {isRejected ? (
              <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-8 w-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            {isRejected ? 'Account Rejected' : 'Account Pending Approval'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isRejected 
              ? 'Your team leader account has been rejected by an administrator'
              : 'Your team leader account is waiting for admin approval'
            }
          </p>
          
          {/* Countdown Timer */}
          {!isRejected && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-center space-x-2">
                <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-blue-800">
                  Auto-redirecting to login in {countdown} seconds
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${((30 - countdown) / 30) * 100}%` }}
                ></div>
              </div>
              
              <p className="mt-2 text-xs text-blue-600">
                You'll be automatically signed out and redirected to the login page
              </p>
            </div>
          )}
        </div>

        {isRejected ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Account Rejected
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>
                    Your team leader account has been rejected by an administrator. 
                    If you believe this was an error, you can delete your account and sign up again with the same email.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Approval Required
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Your team leader account has been created but requires admin approval before you can access the dashboard. 
                    You will be notified once your account is approved.
                  </p>
                  <p className="mt-2 font-medium">
                    💡 While waiting, you can sign out and sign back in later to check your approval status.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-50 rounded-md p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Account Details</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <p><span className="font-medium">Name:</span> {user?.displayName}</p>
            <p><span className="font-medium">Email:</span> {user?.email}</p>
            <p><span className="font-medium">Role:</span> Team Leader</p>
            <p><span className="font-medium">Status:</span> {isRejected ? 'Rejected' : 'Pending Approval'}</p>
          </div>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <div className="text-sm text-green-700">{success}</div>
          </div>
        )}

        <div className="text-center space-y-3">
          {isRejected && (
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Deleting...' : 'Delete Account & Reuse Email'}
            </button>
          )}
          
          <div className="flex flex-col space-y-2">
            {!isRejected && (
              <button
                onClick={handleAutoRedirect}
                disabled={isRedirecting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRedirecting ? 'Redirecting...' : 'Go to Login Now'}
              </button>
            )}
            
            <button
              onClick={handleSignOut}
              className="text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors duration-200"
            >
              Sign out manually
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-center p-6 border-b border-gray-200">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-4">
                Delete Account
              </h3>
              
              <div className="text-center mb-6">
                <p className="text-gray-600 mb-3">
                  Are you sure you want to delete your account? This will allow you to sign up again with the same email address.
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800 font-medium">
                    ✅ You can reuse your email after deletion
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    This action will completely remove your account from the system.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex justify-end space-x-3 px-6 py-4 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </span>
                ) : (
                  'Delete Account'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingApproval;
