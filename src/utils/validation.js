/**
 * Validation Utilities
 * 
 * Common validation functions for form inputs.
 */

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {string|null} Error message or null if valid
 */
export const validateEmail = (email) => {
  if (!email) {
    return 'Email is required';
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  
  return null;
};

/**
 * Validate password
 * @param {string} password - Password to validate
 * @param {object} options - Validation options
 * @returns {object} { isValid: boolean, errors: string[], strength: string }
 */
export const validatePassword = (password, options = {}) => {
  const {
    minLength = 6,
    requireUppercase = false,
    requireLowercase = false,
    requireNumber = false,
    requireSpecialChar = false,
  } = options;

  const errors = [];
  let strength = 0;

  if (!password) {
    return { isValid: false, errors: ['Password is required'], strength: 'weak' };
  }

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  } else {
    strength++;
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (/[A-Z]/.test(password)) {
    strength++;
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (/[a-z]/.test(password)) {
    strength++;
  }

  if (requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else if (/[0-9]/.test(password)) {
    strength++;
  }

  if (requireSpecialChar && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else if (/[^A-Za-z0-9]/.test(password)) {
    strength++;
  }

  const strengthLevels = ['weak', 'fair', 'good', 'strong'];
  const strengthLabel = strengthLevels[Math.min(strength - 1, 3)] || 'weak';

  return {
    isValid: errors.length === 0,
    errors,
    strength: strengthLabel,
  };
};

/**
 * Get password strength color
 * @param {string} strength - Password strength level
 * @returns {string} Tailwind color class
 */
export const getPasswordStrengthColor = (strength) => {
  const colors = {
    weak: 'bg-red-500',
    fair: 'bg-yellow-500',
    good: 'bg-blue-500',
    strong: 'bg-green-500',
  };
  return colors[strength] || colors.weak;
};

/**
 * Validate required field
 * @param {string} value - Value to validate
 * @param {string} fieldName - Name of the field
 * @returns {string|null} Error message or null if valid
 */
export const validateRequired = (value, fieldName = 'This field') => {
  if (!value || (typeof value === 'string' && value.trim().length === 0)) {
    return `${fieldName} is required`;
  }
  return null;
};

/**
 * Validate name
 * @param {string} name - Name to validate
 * @returns {string|null} Error message or null if valid
 */
export const validateName = (name) => {
  if (!name || name.trim().length === 0) {
    return 'Name is required';
  }
  
  if (name.trim().length < 2) {
    return 'Name must be at least 2 characters long';
  }
  
  if (name.length > 100) {
    return 'Name must be less than 100 characters';
  }
  
  return null;
};

/**
 * Validate phone number (basic)
 * @param {string} phone - Phone number to validate
 * @returns {string|null} Error message or null if valid
 */
export const validatePhone = (phone) => {
  if (!phone) {
    return null; // Phone is optional
  }
  
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  if (!phoneRegex.test(phone)) {
    return 'Please enter a valid phone number';
  }
  
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 10) {
    return 'Phone number must contain at least 10 digits';
  }
  
  return null;
};

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {string|null} Error message or null if valid
 */
export const validateURL = (url) => {
  if (!url) {
    return null; // URL is optional
  }
  
  try {
    new URL(url);
    return null;
  } catch {
    return 'Please enter a valid URL';
  }
};

/**
 * Validate date
 * @param {string} date - Date to validate
 * @param {object} options - Validation options
 * @returns {string|null} Error message or null if valid
 */
export const validateDate = (date, options = {}) => {
  if (!date) {
    return options.required ? 'Date is required' : null;
  }
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return 'Please enter a valid date';
  }
  
  if (options.minDate) {
    const minDate = new Date(options.minDate);
    if (dateObj < minDate) {
      return `Date must be after ${minDate.toLocaleDateString()}`;
    }
  }
  
  if (options.maxDate) {
    const maxDate = new Date(options.maxDate);
    if (dateObj > maxDate) {
      return `Date must be before ${maxDate.toLocaleDateString()}`;
    }
  }
  
  return null;
};

/**
 * Validate number
 * @param {string|number} value - Number to validate
 * @param {object} options - Validation options
 * @returns {string|null} Error message or null if valid
 */
export const validateNumber = (value, options = {}) => {
  const { min, max, required = false } = options;
  
  if (!value && value !== 0) {
    return required ? 'This field is required' : null;
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) {
    return 'Please enter a valid number';
  }
  
  if (min !== undefined && num < min) {
    return `Value must be at least ${min}`;
  }
  
  if (max !== undefined && num > max) {
    return `Value must be at most ${max}`;
  }
  
  return null;
};
