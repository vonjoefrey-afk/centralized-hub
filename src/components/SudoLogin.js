/**
 * Sudo Login Component (Admin Backdoor)
 * 
 * A secured, unlinked route strictly designed for Administrators who utilize
 * legacy inactive/dummy emails that cannot be authenticated via Google SSO.
 * 
 * SECURITY: The underlying `signIn` function in auth.js explicitly executes
 * an RBAC validation check upon authentication. If a non-Admin account 
 * attempts to authenticate through this backdoor, the server instantly
 * voids the token and ejects the user to prevent exploitation.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signIn, triggerAuthStateChange } from '../firebase/auth';
import { logger } from '../utils/logger';
import { Button, Input } from './ui';
import { validateEmail } from '../utils/validation';
import { showSuccess, showError } from '../utils/toast';

const SudoLogin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Form state management
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Validation states
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  });

  // Redirect if user is already authenticated
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        logger.debug('SudoLogin: Admin is authenticated, redirecting to dashboard');
        navigate('/admin');
      } else {
        logger.warn('SudoLogin: Non-admin found in sudo route. Redirecting to standard front door.');
        navigate('/');
      }
    }
  }, [user, navigate]);

  // Real-time email validation
  useEffect(() => {
    if (touched.email && email) {
      const error = validateEmail(email);
      setEmailError(error);
    } else if (touched.email && !email) {
      setEmailError('Email is required');
    } else {
      setEmailError('');
    }
  }, [email, touched.email]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({
      email: true,
      password: true,
    });

    // Validate form
    let hasErrors = false;

    // Validate email
    const emailValidation = validateEmail(email);
    if (emailValidation) {
      setEmailError(emailValidation);
      hasErrors = true;
    }

    // Validate password
    if (!password) {
      setPasswordError('Password is required');
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    setLoading(true);

    try {
      logger.debug('Attempting to sudo sign in...');
      // Note: `signIn` now internally enforces `role === 'admin'` before returning success!
      await signIn(email, password);
      
      logger.debug('Sudo sign in successful');
      await triggerAuthStateChange();
      showSuccess('System Administrator Authenticated');
      navigate('/admin');
    } catch (err) {
      logger.error('Authentication error:', err);

      let errorMessage = 'An error occurred. Please try again.';

      if (err.message.includes('Administrator privileges required')) {
        errorMessage = 'SECURITY BREACH DETECTED: Non-administrator account. Access Denied.';
      } else if (err.code === 'user-deleted') {
        errorMessage = 'This account has been deleted by an administrator.';
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
        setPasswordError('Incorrect password');
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
        setEmailError('Please enter a valid email address');
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
        setEmailError('This email is already registered');
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center bg-black rounded-2xl shadow-2xl border border-red-500/30">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-white tracking-tight">
            Terminal Access
          </h2>
          <p className="mt-2 text-sm text-red-400">
            Authorized System Administrators Only
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-black/60 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-red-500/20">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="sudo-input-wrapper">
                <Input
                  id="email"
                  label="Administrative Email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setTouched(prev => ({ ...prev, email: true }));
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                  error={touched.email ? emailError : null}
                  success={touched.email && !emailError && email ? true : false}
                  placeholder="admin@system.local"
                  required
                  autoComplete="email"
                  className="bg-zinc-900 text-white border-zinc-700 focus:border-red-500 focus:ring-red-500"
                />
              </div>

              <div className="sudo-input-wrapper mt-4">
                <Input
                  id="password"
                  label="Security Passkey"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setTouched(prev => ({ ...prev, password: true }));
                  }}
                  onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                  error={touched.password ? passwordError : null}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  showPasswordToggle={true}
                  className="bg-zinc-900 text-white border-zinc-700 focus:border-red-500 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white border-none shadow-[0_0_15px_rgba(220,38,38,0.3)] transition-all"
              >
                Execute
              </Button>
            </div>

            <div className="text-center mt-6">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">
                System Interaction Logged
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SudoLogin;
