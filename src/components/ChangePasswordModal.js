import React, { useState, useEffect } from 'react';
import { changePassword } from '../firebase/auth';
import { Modal, Input, Button } from './ui';
import { validatePassword, getPasswordStrengthColor } from '../utils/validation';
import { showSuccess, showError } from '../utils/toast';
import { KeyIcon } from '@heroicons/react/24/outline';

/**
 * ChangePasswordModal Component
 * 
 * Enhanced modal with real-time validation and password strength indicator.
 */
const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Validation states
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(null);
  const [touched, setTouched] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPasswordError('');
      setNewPasswordError('');
      setConfirmPasswordError('');
      setPasswordStrength(null);
      setTouched({ currentPassword: false, newPassword: false, confirmPassword: false });
    }
  }, [isOpen]);

  // Real-time password validation
  useEffect(() => {
    if (touched.newPassword && newPassword) {
      const validation = validatePassword(newPassword, { minLength: 6 });
      if (!validation.isValid) {
        setNewPasswordError(validation.errors[0]);
      } else {
        setNewPasswordError('');
      }
      setPasswordStrength(validation.strength);
    } else if (touched.newPassword && !newPassword) {
      setNewPasswordError('Password is required');
      setPasswordStrength(null);
    } else {
      setNewPasswordError('');
      setPasswordStrength(null);
    }
  }, [newPassword, touched.newPassword]);

  // Validate password match
  useEffect(() => {
    if (touched.confirmPassword && confirmPassword) {
      if (confirmPassword !== newPassword) {
        setConfirmPasswordError('Passwords do not match');
      } else {
        setConfirmPasswordError('');
      }
    } else if (touched.confirmPassword && !confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
    } else {
      setConfirmPasswordError('');
    }
  }, [confirmPassword, newPassword, touched.confirmPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({
      currentPassword: true,
      newPassword: true,
      confirmPassword: true,
    });

    // Validate all fields
    let hasErrors = false;

    if (!currentPassword) {
      setCurrentPasswordError('Current password is required');
      hasErrors = true;
    }

    if (!newPassword) {
      setNewPasswordError('New password is required');
      hasErrors = true;
    } else {
      const validation = validatePassword(newPassword, { minLength: 6 });
      if (!validation.isValid) {
        setNewPasswordError(validation.errors[0]);
        hasErrors = true;
      }
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      hasErrors = true;
    } else if (confirmPassword !== newPassword) {
      setConfirmPasswordError('Passwords do not match');
      hasErrors = true;
    }

    if (currentPassword === newPassword) {
      setNewPasswordError('New password must be different from current password');
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    try {
      setLoading(true);
      await changePassword(currentPassword, newPassword);
      showSuccess('Password changed successfully!');
      
      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      if (err.code === 'auth/wrong-password') {
        setCurrentPasswordError('Incorrect current password');
        showError('Incorrect current password. Please try again.');
      } else {
        showError(err.message || 'Failed to change password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <Modal.Header onClose={onClose}>
        <div className="flex items-center">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full mr-3">
            <KeyIcon className="w-5 h-5 text-blue-600" aria-hidden="true" />
          </div>
          <Modal.Title>Change Password</Modal.Title>
        </div>
      </Modal.Header>
      
      <Modal.Body>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="currentPassword"
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setTouched(prev => ({ ...prev, currentPassword: true }));
              setCurrentPasswordError('');
            }}
            onBlur={() => setTouched(prev => ({ ...prev, currentPassword: true }))}
            error={touched.currentPassword ? currentPasswordError : null}
            placeholder="Enter your current password"
            required
            autoComplete="current-password"
            showPasswordToggle={true}
            disabled={loading}
          />

          <div>
            <Input
              id="newPassword"
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setTouched(prev => ({ ...prev, newPassword: true }));
              }}
              onBlur={() => setTouched(prev => ({ ...prev, newPassword: true }))}
              error={touched.newPassword ? newPasswordError : null}
              placeholder="Enter your new password (min. 6 characters)"
              required
              minLength={6}
              autoComplete="new-password"
              showPasswordToggle={true}
              disabled={loading}
            />
            
            {/* Password Strength Indicator */}
            {newPassword && touched.newPassword && !newPasswordError && passwordStrength && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">Password strength:</span>
                  <span className={`text-xs font-medium capitalize ${
                    passwordStrength === 'weak' ? 'text-red-600' :
                    passwordStrength === 'fair' ? 'text-yellow-600' :
                    passwordStrength === 'good' ? 'text-blue-600' :
                    'text-green-600'
                  }`}>
                    {passwordStrength}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor(passwordStrength)}`}
                    style={{
                      width: passwordStrength === 'weak' ? '25%' :
                             passwordStrength === 'fair' ? '50%' :
                             passwordStrength === 'good' ? '75%' : '100%'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <Input
            id="confirmPassword"
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setTouched(prev => ({ ...prev, confirmPassword: true }));
            }}
            onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))}
            error={touched.confirmPassword ? confirmPasswordError : null}
            success={touched.confirmPassword && !confirmPasswordError && confirmPassword && confirmPassword === newPassword}
            placeholder="Confirm your new password"
            required
            minLength={6}
            autoComplete="new-password"
            showPasswordToggle={true}
            disabled={loading}
          />
        </form>
      </Modal.Body>

      <Modal.Footer>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading}
          onClick={handleSubmit}
        >
          Change Password
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ChangePasswordModal;
