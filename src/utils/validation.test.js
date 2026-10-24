import { 
  validateEmail, 
  validatePassword, 
  getPasswordStrengthColor, 
  validateRequired, 
  validateName, 
  validatePhone, 
  validateURL, 
  validateDate, 
  validateNumber 
} from './validation';

describe('Validation Utilities', () => {

  describe('validateEmail', () => {
    it('should return error if email is empty', () => {
      expect(validateEmail('')).toBe('Email is required');
    });

    it('should return error for invalid email formats', () => {
      expect(validateEmail('invalid-email')).toBe('Please enter a valid email address');
      expect(validateEmail('test@test')).toBe('Please enter a valid email address');
      expect(validateEmail('test@.com')).toBe('Please enter a valid email address');
    });

    it('should return null for valid email address', () => {
      expect(validateEmail('test@example.com')).toBeNull();
    });
  });

  describe('validatePassword', () => {
    it('should return weak strength for empty password', () => {
      const result = validatePassword('');
      expect(result.isValid).toBeFalsy();
      expect(result.strength).toBe('weak');
      expect(result.errors).toContain('Password is required');
    });

    it('should validate minimum length', () => {
      const result = validatePassword('12345', { minLength: 6 });
      expect(result.isValid).toBeFalsy();
      expect(result.errors).toContain('Password must be at least 6 characters long');
    });

    it('should validate uppercase requirement', () => {
      const result = validatePassword('password', { requireUppercase: true });
      expect(result.isValid).toBeFalsy();
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should return strong for password meeting all criteria', () => {
      const result = validatePassword('StrongP@ssw0rd!', {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecialChar: true,
      });
      expect(result.isValid).toBeTruthy();
      expect(result.strength).toBe('strong');
      expect(result.errors.length).toBe(0);
    });
  });

  describe('getPasswordStrengthColor', () => {
    it('should return correct tailwind classes based on strength', () => {
      expect(getPasswordStrengthColor('weak')).toBe('bg-red-500');
      expect(getPasswordStrengthColor('good')).toBe('bg-blue-500');
      expect(getPasswordStrengthColor('unknown')).toBe('bg-red-500'); // defaults to weak
    });
  });

  describe('validateRequired', () => {
    it('should validate empty strings', () => {
      expect(validateRequired('', 'Name')).toBe('Name is required');
      expect(validateRequired('   ', 'Name')).toBe('Name is required');
      expect(validateRequired(null, 'Name')).toBe('Name is required');
    });

    it('should return null for valid values', () => {
      expect(validateRequired('John', 'Name')).toBeNull();
    });
  });

  describe('validateName', () => {
    it('should reject empty or extremely short names', () => {
      expect(validateName('')).toBe('Name is required');
      expect(validateName('A')).toBe('Name must be at least 2 characters long');
    });

    it('should validate standard names', () => {
      expect(validateName('John Doe')).toBeNull();
    });
  });

  describe('validatePhone', () => {
    it('should allow empty phone if optional', () => {
      expect(validatePhone('')).toBeNull();
    });

    it('should reject letters in phone number', () => {
      expect(validatePhone('123-abc-4567')).toBe('Please enter a valid phone number');
    });

    it('should ensure phone number has at least 10 digits', () => {
      expect(validatePhone('123-456')).toBe('Phone number must contain at least 10 digits');
    });

    it('should accept valid formatting', () => {
      expect(validatePhone('+1 (555) 123-4567')).toBeNull();
    });
  });

  describe('validateURL', () => {
    it('should allow empty URL', () => {
      expect(validateURL('')).toBeNull();
    });

    it('should reject invalid URLs', () => {
      expect(validateURL('not-a-url')).toBe('Please enter a valid URL');
    });

    it('should accept valid URLs', () => {
      expect(validateURL('https://example.com')).toBeNull();
    });
  });

  describe('validateNumber', () => {
    it('should enforce required option', () => {
      expect(validateNumber('', { required: true })).toBe('This field is required');
    });

    it('should enforce minimum bounds', () => {
      expect(validateNumber(5, { min: 10 })).toBe('Value must be at least 10');
    });

    it('should enforce maximum bounds', () => {
      expect(validateNumber(15, { max: 10 })).toBe('Value must be at most 10');
    });

    it('should accept valid numbers within boundaries', () => {
      expect(validateNumber(5, { min: 1, max: 10 })).toBeNull();
    });
  });
});
