import { useState, useEffect } from 'react';
import { User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/auth.css';

export default function Register({ onBackToLogin, onRegisterSuccess }) {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'student',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState('');

  const calculatePasswordStrength = (pass) => {
    if (!pass) return '';
    if (pass.length < 6) return 'weak';
    if (pass.length < 10) return 'medium';
    if (pass.length >= 10 && /[A-Z]/.test(pass) && /[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) {
      return 'strong';
    }
    return 'medium';
  };

  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(formData.password));
  }, [formData.password]);

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (generalError) setGeneralError('');
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!validateEmail(formData.email.trim())) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirmation is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError('');

    try {
      await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
      });

      setIsSuccess(true);
      if (onRegisterSuccess) {
        onRegisterSuccess(formData.email.trim());
      }
    } catch (err) {
      console.error('Registration error:', err);
      setGeneralError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="auth-container">
        <div className="auth-background">
          <div className="auth-particles"></div>
          <div className="auth-orbital"></div>
        </div>

        <div className="auth-panel">
          <div className="auth-success">
            <div className="auth-success-icon">
              <CheckCircle size={32} />
            </div>
            <h3>Account Created</h3>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: '20px' }}>
              Your ENSIASD account for{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{formData.email}</strong> has been
              successfully registered in the system.
            </p>
            <button
              type="button"
              className="auth-btn auth-btn-primary auth-btn-full"
              onClick={() => {
                if (onBackToLogin) onBackToLogin();
                else window.location.hash = '#login';
              }}
            >
              Proceed to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="auth-particles"></div>
        <div className="auth-orbital"></div>
      </div>

      <div className="auth-panel">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="auth-logo-icon">E</div>
            <span className="auth-title">ENSIASD</span>
          </div>
          <div className="auth-subtitle">Academic Intelligence Platform</div>
        </div>

        <div className="auth-welcome">
          <h2>Create Account</h2>
          <p>Join the ENSIASD AI Assistant institutional workspace</p>
        </div>

        {generalError && (
          <div className="auth-alert auth-alert-error" style={{ marginBottom: '16px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{generalError}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="name" className="form-label">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              className={`form-input ${errors.name ? 'error' : ''}`}
              placeholder="e.g. Alex Morgan"
              value={formData.name}
              onChange={handleInputChange}
              disabled={isLoading}
              autoComplete="name"
              autoFocus
            />
            {errors.name && (
              <span className="form-field-error">
                <AlertCircle size={13} />
                {errors.name}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Institutional Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="student@ensiasd.edu"
              value={formData.email}
              onChange={handleInputChange}
              disabled={isLoading}
              autoComplete="email"
            />
            {errors.email && (
              <span className="form-field-error">
                <AlertCircle size={13} />
                {errors.email}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="role" className="form-label">
              Academic Role
            </label>
            <select
              id="role"
              name="role"
              className="form-select"
              value={formData.role}
              onChange={handleInputChange}
              disabled={isLoading}
            >
              <option value="student">Student</option>
              <option value="professor">Professor / Faculty</option>
              <option value="researcher">Researcher</option>
              <option value="admin">Administrator / Admin</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder="Create secure password"
                value={formData.password}
                onChange={handleInputChange}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <span className="form-field-error">
                <AlertCircle size={13} />
                {errors.password}
              </span>
            )}

            {formData.password && (
              <div className="password-strength">
                <div className="password-strength-label">
                  <span>Strength:</span>
                  <span
                    style={{
                      textTransform: 'capitalize',
                      fontWeight: 600,
                      color:
                        passwordStrength === 'strong'
                          ? '#34D399'
                          : passwordStrength === 'medium'
                          ? '#FBBF24'
                          : '#F87171',
                    }}
                  >
                    {passwordStrength}
                  </span>
                </div>
                <div className="password-strength-bar">
                  <div className={`password-strength-fill ${passwordStrength}`}></div>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              Confirm Password
            </label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="form-field-error">
                <AlertCircle size={13} />
                {errors.confirmPassword}
              </span>
            )}
            {formData.confirmPassword && formData.password === formData.confirmPassword && (
              <span className="form-field-success">
                <CheckCircle size={13} /> Passwords match
              </span>
            )}
          </div>

          <button
            type="submit"
            className={`auth-btn auth-btn-primary auth-btn-full ${
              isLoading ? 'auth-btn-loading' : ''
            }`}
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Register Account'}
          </button>
        </form>

        <div className="auth-switcher">
          <span>Already have an account?</span>
          <a
            href="#login"
            onClick={(e) => {
              e.preventDefault();
              if (onBackToLogin) onBackToLogin();
              else window.location.hash = '#login';
            }}
          >
            Sign In
          </a>
        </div>
      </div>
    </div>
  );
}
