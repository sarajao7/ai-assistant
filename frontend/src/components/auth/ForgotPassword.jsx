import { useState } from 'react';
import { Mail, ArrowLeft, AlertCircle, CheckCircle, KeyRound } from 'lucide-react';
import { authApi } from '../../services/authApi';
import '../../styles/auth.css';

export default function ForgotPassword({ onBackToLogin, onProceedToReset }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateEmail = (val) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleInputChange = (e) => {
    setEmail(e.target.value);
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Email address is required');
      return;
    }
    if (!validateEmail(cleanEmail)) {
      setError('Invalid email format');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authApi.forgotPassword(cleanEmail);
      // The backend returns { message: "...", expires: token }
      const token = response.expires || response.token || response.reset_token;
      setResetToken(token);
      setIsSuccess(true);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(err.message || 'Unable to process reset request. Please check the email and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetNavigation = () => {
    if (onProceedToReset) {
      onProceedToReset(resetToken);
    } else {
      window.location.hash = resetToken
        ? `#reset-password?token=${encodeURIComponent(resetToken)}`
        : '#reset-password';
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
            <h3>Reset Instructions Sent</h3>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: '16px', lineHeight: 1.5 }}>
              A password reset verification was generated for{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
            </p>

            {resetToken && (
              <div className="auth-demo-hint" style={{ marginBottom: '20px' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>
                  Verification Token Ready
                </strong>
                <span style={{ wordBreak: 'break-all', fontFamily: 'var(--font-mono, monospace)' }}>
                  {resetToken}
                </span>
              </div>
            )}

            <button
              type="button"
              className="auth-btn auth-btn-primary auth-btn-full"
              onClick={handleResetNavigation}
              style={{ marginBottom: '12px' }}
            >
              <KeyRound size={16} />
              Set New Password Now
            </button>

            <button
              type="button"
              className="auth-btn auth-btn-secondary auth-btn-full"
              onClick={() => {
                if (onBackToLogin) onBackToLogin();
                else window.location.hash = '#login';
              }}
            >
              Back to Sign In
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
          <h2>Reset Password</h2>
          <p>Enter your institutional email and we will generate a secure reset token</p>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error" style={{ marginBottom: '16px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Institutional Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className={`form-input ${error ? 'error' : ''}`}
              placeholder="e.g. student@ensiasd.edu"
              value={email}
              onChange={handleInputChange}
              disabled={isLoading}
              autoComplete="email"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className={`auth-btn auth-btn-primary auth-btn-full ${
              isLoading ? 'auth-btn-loading' : ''
            }`}
            disabled={isLoading}
          >
            {isLoading ? 'Generating Instructions...' : 'Send Reset Instructions'}
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
