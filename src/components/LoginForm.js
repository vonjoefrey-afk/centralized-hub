/**
 * Login Form Component
 * 
 * High-end UI/UX Redesign: Implements modern dark-theme glassmorphism,
 * abstract glowing background orbs, and premium typography.
 * Signup flow and email/password have been removed to enforce Google SSO globally.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signInWithGoogle } from '../firebase/auth';
import { logger } from '../utils/logger';
import { showSuccess, showError } from '../utils/toast';
import { ShieldCheckIcon } from '@heroicons/react/24/outline'; // Premium icon

const LoginForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Redirect if user is already authenticated
  useEffect(() => {
    if (user) {
      logger.debug('LoginForm: User is authenticated, redirecting to dashboard');
      navigate('/');
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      logger.debug('Attempting Google sign in...');
      const result = await signInWithGoogle();
      if (result.success) {
        showSuccess('Successfully signed in with Google!');
        navigate('/');
      }
    } catch (err) {
      logger.error('Google sign-in error:', err);
      showError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#050505]">
      
      {/* Abstract Glowing Background Orbs — Aurora Signal (indigo → cyan → violet) */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/12 blur-[150px] pointer-events-none" />
      <div className="absolute top-[20%] right-[15%] w-[300px] h-[300px] rounded-full bg-violet-600/12 blur-[100px] pointer-events-none" />

      {/* Main Glassmorphic Card */}
      <div className="relative z-10 w-full max-w-[420px] mx-4 p-10 bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
        
        {/* Header Section */}
        <div className="flex flex-col items-center justify-center mb-10">
          <div className="p-4 bg-gradient-to-br from-indigo-500/25 to-cyan-500/20 rounded-2xl border border-indigo-500/25 shadow-[0_0_24px_rgba(34,211,238,0.18)] mb-6">
            <ShieldCheckIcon className="w-10 h-10 text-cyan-300" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-cyan-300 text-center mb-3">
            Secure Gateway
          </h2>
          <p className="text-gray-400 text-center text-sm leading-relaxed max-w-[280px]">
            Authenticate via the enterprise network to access the Team Portal.
          </p>
        </div>

        {/* Action Section */}
        <div className="space-y-6">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="group relative w-full flex items-center justify-center gap-3 px-4 py-4 bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-xl transition-all duration-300 overflow-hidden outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            {/* Hover Gradient Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-cyan-500/10 to-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {loading ? (
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              // Official Google SVG (Clean Paths)
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span className="relative z-10 text-gray-200 font-medium tracking-wide text-sm">
              {loading ? 'Authenticating...' : 'Continue with Google SSO'}
            </span>
          </button>

          {/* Security Footer */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
              <span className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">Enterprise SSO Active</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed max-w-[280px] mx-auto">
              Team Members must sign in using their authorized <span className="text-gray-400">@google.com</span> domain.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoginForm;
