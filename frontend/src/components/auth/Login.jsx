import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/auth.css';

export default function Login({ onForgotPassword, onRegister, onLoginSuccess }) {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: localStorage.getItem('ensiasd_remembered_email') || '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() =>
    Boolean(localStorage.getItem('ensiasd_remembered_email'))
  );
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

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
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email.trim())) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
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
      if (rememberMe) {
        localStorage.setItem('ensiasd_remembered_email', formData.email.trim());
      } else {
        localStorage.removeItem('ensiasd_remembered_email');
      }

      const user = await login(formData.email.trim(), formData.password);

      if (onLoginSuccess) {
        onLoginSuccess(user);
      } else {
        window.location.hash = '';
      }
    } catch (err) {
      console.error('Login error:', err);
      setGeneralError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
          <span className="auth-status">Academic Intelligence System</span>
        </div>

        <div className="auth-welcome">
          <h2>Welcome Back</h2>
          <p>Sign in to access your institutional AI assistant</p>
        </div>

        {generalError && (
          <div className="auth-alert auth-alert-error" style={{ marginBottom: '16px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{generalError}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Institutional Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="e.g. name@ensiasd.edu"
              value={formData.email}
              onChange={handleInputChange}
              disabled={isLoading}
              autoComplete="email"
              autoFocus
            />
            {errors.email && (
              <span className="form-field-error">
                <AlertCircle size={13} />
                {errors.email}
              </span>
            )}
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
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleInputChange}
                disabled={isLoading}
                autoComplete="current-password"
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
          </div>

          <div className="form-row">
            <label className="form-checkbox-container">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
              />
              <span className="form-checkbox-label">Remember email</span>
            </label>

            <a
              href="#forgot-password"
              className="form-link"
              onClick={(e) => {
                e.preventDefault();
                if (onForgotPassword) onForgotPassword();
                else window.location.hash = '#forgot-password';
              }}
            >
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            className={`auth-btn auth-btn-primary auth-btn-full ${
              isLoading ? 'auth-btn-loading' : ''
            }`}
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-switcher">
          <span>Don't have an account?</span>
          <a
            href="#register"
            onClick={(e) => {
              e.preventDefault();
              if (onRegister) onRegister();
              else window.location.hash = '#register';
            }}
          >
            Create account
          </a>
        </div>
      </div>
    </div>
  );
}
