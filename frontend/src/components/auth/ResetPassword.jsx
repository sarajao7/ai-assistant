import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft, KeyRound } from 'lucide-react';
import { authApi } from '../../services/authApi';
import '../../styles/auth.css';

export default function ResetPassword({ initialToken = '', onResetSuccess, onBackToLogin }) {
  const [resetToken, setResetToken] = useState(() => {
    if (initialToken) return initialToken;
    const match = window.location.hash.match(/[?&]token=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  });

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
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
    if (!resetToken.trim()) {
      newErrors.resetToken = 'Reset token is required';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm password';
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
      await authApi.resetPassword({
        resetToken: resetToken.trim(),
        newPassword: formData.password,
      });

      setIsSuccess(true);
      if (onResetSuccess) {
        onResetSuccess();
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setGeneralError(err.message || 'Failed to reset password. The token may be expired or invalid.');
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
            <h3>Password Reset Complete</h3>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: '24px', lineHeight: 1.5 }}>
              Your password has been securely updated in the database. You can now sign in with your
              new credentials.
            </p>
            <button
              type="button"
              className="auth-btn auth-btn-primary auth-btn-full"
              onClick={() => {
                if (onBackToLogin) onBackToLogin();
                else window.location.hash = '#login';
              }}
            >
              Sign In with New Password
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
          <div className="auth-subtitle">AI Assistant Platform</div>
        </div>

        <div className="auth-welcome">
          <h2>Create New Password</h2>
          <p>Please enter your reset token and choose a strong password</p>
        </div>

        {generalError && (
          <div className="auth-alert auth-alert-error" style={{ marginBottom: '16px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{generalError}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="resetToken" className="form-label">
              Reset Token
            </label>
            <div className="password-input-wrapper">
              <input
                type="text"
                id="resetToken"
                name="resetToken"
                className={`form-input ${errors.resetToken ? 'error' : ''}`}
                placeholder="Paste the reset token here"
                value={resetToken}
                onChange={(e) => {
                  setResetToken(e.target.value);
                  if (errors.resetToken) setErrors((prev) => ({ ...prev, resetToken: '' }));
                }}
                disabled={isLoading}
              />
            </div>
            {errors.resetToken && (
              <span className="form-field-error">
                <AlertCircle size={13} />
                {errors.resetToken}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              New Password
            </label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder="Enter new password"
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
              Confirm New Password
            </label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                placeholder="Confirm new password"
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
            {isLoading ? 'Updating Password...' : 'Reset Password'}
          </button>
        </form>

        <div className="auth-back">
          <a
            href="#login"
            onClick={(e) => {
              e.preventDefault();
              if (onBackToLogin) onBackToLogin();
              else window.location.hash = '#login';
            }}
          >
            <ArrowLeft size={16} />
            Back to Sign In
          </a>
        </div>
      </div>
    </div>
  );
}
