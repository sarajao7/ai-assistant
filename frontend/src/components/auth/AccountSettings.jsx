import { useState } from 'react';
import {
  User,
  Mail,
  Lock,
  LogOut,
  Edit2,
  X,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/account.css';

export default function AccountSettings({ onSignOut, onBackToChat }) {
  const { user, updateProfile, changePassword, logout } = useAuth();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const [message, setMessage] = useState({ type: '', text: '' });
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});

  const showFlash = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage({ type: '', text: '' });
    }, 4500);
  };

  const validateEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleProfileSave = async () => {
    const errs = {};
    if (!profileData.name.trim()) errs.name = 'Full name is required';
    if (!profileData.email.trim()) errs.email = 'Email is required';
    else if (!validateEmail(profileData.email.trim())) errs.email = 'Invalid email format';

    if (Object.keys(errs).length > 0) {
      setProfileErrors(errs);
      return;
    }

    setIsProfileSaving(true);
    setProfileErrors({});

    try {
      await updateProfile(profileData.name.trim(), profileData.email.trim());
      setIsEditingProfile(false);
      showFlash('success', 'Profile information updated successfully');
    } catch (err) {
      console.error('Update profile error:', err);
      showFlash('error', err.message || 'Failed to update profile information');
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    const errs = {};
    if (!passwordData.current) errs.current = 'Current password is required';
    if (!passwordData.new) errs.new = 'New password is required';
    else if (passwordData.new.length < 6) errs.new = 'Must be at least 6 characters';
    if (!passwordData.confirm) errs.confirm = 'Please confirm new password';
    else if (passwordData.new !== passwordData.confirm) errs.confirm = 'Passwords do not match';

    if (Object.keys(errs).length > 0) {
      setPasswordErrors(errs);
      return;
    }

    setIsPasswordSaving(true);
    setPasswordErrors({});

    try {
      await changePassword(passwordData.current, passwordData.new);
      setIsChangingPassword(false);
      setPasswordData({ current: '', new: '', confirm: '' });
      showFlash('success', 'Password changed successfully');
    } catch (err) {
      console.error('Change password error:', err);
      showFlash('error', err.message || 'Failed to change password');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handleSignOut = async () => {
    setShowSignOutModal(false);
    try {
      await logout();
      if (onSignOut) {
        onSignOut();
      } else {
        window.location.hash = '#login';
      }
    } catch (err) {
      console.error('Logout error:', err);
      window.location.hash = '#login';
    }
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <div className="account-page">
      <div className="account-container">
        {/* Top Navigation */}
        <div className="account-topbar">
          <button
            type="button"
            className="account-back-btn"
            onClick={() => {
              if (onBackToChat) onBackToChat();
              else window.location.hash = '';
            }}
          >
            <ArrowLeft size={16} />
            {(user?.role === 'admin' || user?.role === 'administrator' || user?.role === 'staff' || user?.email?.includes('admin'))
              ? 'Back to Admin Panel'
              : 'Back to Assistant'}
          </button>
        </div>

        {/* Page Title */}
        <div className="account-header">
          <h1>Account & Security</h1>
          <p>Manage your institutional credentials, profile information, and preferences</p>
        </div>

        {/* Global Feedback Alert */}
        {message.text && (
          <div className={`account-message account-message-${message.type}`}>
            {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* User Identity Banner */}
        <div className="account-identity">
          <div className="account-avatar">{initials}</div>

          <div className="account-identity-info">
            <div className="account-name">{user?.name || 'Academic User'}</div>
            <div className="account-email">{user?.email || 'user@ensiasd.edu'}</div>

            <div className="account-meta">
              <span className="account-role">
                <User size={12} />
                {user?.role || 'student'}
              </span>
              <span className="account-status">
                <span className="account-status-dot"></span>
                Active Session
              </span>
            </div>
          </div>
        </div>

        {/* Section 1: Profile Information */}
        <div className="account-section">
          <div className="account-section-header">
            <div>
              <div className="account-section-title">Profile Information</div>
              <div className="account-section-description">
                Your personal details used across the academic workspace
              </div>
            </div>
          </div>

          {!isEditingProfile ? (
            <>
              <div className="account-field">
                <span className="account-field-label">Full Name</span>
                <div className="account-field-value">
                  <span className="account-field-text">{user?.name}</span>
                </div>
              </div>

              <div className="account-field">
                <span className="account-field-label">Institutional Email</span>
                <div className="account-field-value">
                  <span className="account-field-text">{user?.email}</span>
                </div>
              </div>

              <div className="account-field">
                <span className="account-field-label">Account Role</span>
                <div className="account-field-value">
                  <span className="account-field-text" style={{ textTransform: 'capitalize' }}>
                    {user?.role || 'Student'}
                  </span>
                </div>
              </div>

              <div className="account-form-actions">
                <button
                  type="button"
                  className="auth-btn auth-btn-primary"
                  onClick={() => {
                    setProfileData({ name: user?.name || '', email: user?.email || '' });
                    setIsEditingProfile(true);
                  }}
                >
                  <Edit2 size={15} />
                  Edit Profile
                </button>
              </div>
            </>
          ) : (
            <div className="account-edit-form">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className={`form-input ${profileErrors.name ? 'error' : ''}`}
                  value={profileData.name}
                  onChange={(e) => {
                    setProfileData({ ...profileData, name: e.target.value });
                    if (profileErrors.name) setProfileErrors({ ...profileErrors, name: '' });
                  }}
                  disabled={isProfileSaving}
                />
                {profileErrors.name && (
                  <span className="form-field-error">
                    <AlertCircle size={13} />
                    {profileErrors.name}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Institutional Email</label>
                <input
                  type="email"
                  className={`form-input ${profileErrors.email ? 'error' : ''}`}
                  value={profileData.email}
                  onChange={(e) => {
                    setProfileData({ ...profileData, email: e.target.value });
                    if (profileErrors.email) setProfileErrors({ ...profileErrors, email: '' });
                  }}
                  disabled={isProfileSaving}
                />
                {profileErrors.email && (
                  <span className="form-field-error">
                    <AlertCircle size={13} />
                    {profileErrors.email}
                  </span>
                )}
              </div>

              <div className="account-form-actions">
                <button
                  type="button"
                  className="auth-btn auth-btn-secondary"
                  onClick={() => {
                    setIsEditingProfile(false);
                    setProfileData({ name: user?.name || '', email: user?.email || '' });
                    setProfileErrors({});
                  }}
                  disabled={isProfileSaving}
                >
                  <X size={15} />
                  Cancel
                </button>

                <button
                  type="button"
                  className={`auth-btn auth-btn-primary ${
                    isProfileSaving ? 'auth-btn-loading' : ''
                  }`}
                  onClick={handleProfileSave}
                  disabled={isProfileSaving}
                >
                  <Check size={15} />
                  {isProfileSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Password & Security */}
        <div className="account-section">
          <div className="account-section-header">
            <div>
              <div className="account-section-title">Password & Security</div>
              <div className="account-section-description">
                Ensure your account credentials remain secure
              </div>
            </div>
          </div>

          {!isChangingPassword ? (
            <>
              <div className="account-field">
                <span className="account-field-label">Password</span>
                <div className="account-field-value">
                  <span className="account-field-muted">••••••••••••••••</span>
                </div>
              </div>

              <div className="account-form-actions">
                <button
                  type="button"
                  className="auth-btn auth-btn-primary"
                  onClick={() => setIsChangingPassword(true)}
                >
                  <Lock size={15} />
                  Change Password
                </button>
              </div>
            </>
          ) : (
            <div className="account-edit-form">
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    className={`form-input ${passwordErrors.current ? 'error' : ''}`}
                    placeholder="Enter existing password"
                    value={passwordData.current}
                    onChange={(e) => {
                      setPasswordData({ ...passwordData, current: e.target.value });
                      if (passwordErrors.current)
                        setPasswordErrors({ ...passwordErrors, current: '' });
                    }}
                    disabled={isPasswordSaving}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPasswords({
                        ...showPasswords,
                        current: !showPasswords.current,
                      })
                    }
                    disabled={isPasswordSaving}
                    aria-label={showPasswords.current ? 'Hide password' : 'Show password'}
                  >
                    {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordErrors.current && (
                  <span className="form-field-error">
                    <AlertCircle size={13} />
                    {passwordErrors.current}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    className={`form-input ${passwordErrors.new ? 'error' : ''}`}
                    placeholder="At least 6 characters"
                    value={passwordData.new}
                    onChange={(e) => {
                      setPasswordData({ ...passwordData, new: e.target.value });
                      if (passwordErrors.new) setPasswordErrors({ ...passwordErrors, new: '' });
                    }}
                    disabled={isPasswordSaving}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPasswords({ ...showPasswords, new: !showPasswords.new })
                    }
                    disabled={isPasswordSaving}
                    aria-label={showPasswords.new ? 'Hide password' : 'Show password'}
                  >
                    {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordErrors.new && (
                  <span className="form-field-error">
                    <AlertCircle size={13} />
                    {passwordErrors.new}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    className={`form-input ${passwordErrors.confirm ? 'error' : ''}`}
                    placeholder="Repeat new password"
                    value={passwordData.confirm}
                    onChange={(e) => {
                      setPasswordData({ ...passwordData, confirm: e.target.value });
                      if (passwordErrors.confirm)
                        setPasswordErrors({ ...passwordErrors, confirm: '' });
                    }}
                    disabled={isPasswordSaving}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPasswords({
                        ...showPasswords,
                        confirm: !showPasswords.confirm,
                      })
                    }
                    disabled={isPasswordSaving}
                    aria-label={showPasswords.confirm ? 'Hide password' : 'Show password'}
                  >
                    {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordErrors.confirm && (
                  <span className="form-field-error">
                    <AlertCircle size={13} />
                    {passwordErrors.confirm}
                  </span>
                )}
              </div>

              <div className="account-form-actions">
                <button
                  type="button"
                  className="auth-btn auth-btn-secondary"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordData({ current: '', new: '', confirm: '' });
                    setPasswordErrors({});
                  }}
                  disabled={isPasswordSaving}
                >
                  <X size={15} />
                  Cancel
                </button>

                <button
                  type="button"
                  className={`auth-btn auth-btn-primary ${
                    isPasswordSaving ? 'auth-btn-loading' : ''
                  }`}
                  onClick={handlePasswordSave}
                  disabled={isPasswordSaving}
                >
                  <Check size={15} />
                  {isPasswordSaving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sign Out Action */}
        <div className="account-signout">
          <button
            type="button"
            className="btn-signout"
            onClick={() => setShowSignOutModal(true)}
          >
            <LogOut size={16} />
            Sign Out of Workspace
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showSignOutModal && (
        <div
          className="account-modal-overlay"
          onClick={() => setShowSignOutModal(false)}
        >
          <div className="account-modal" onClick={(e) => e.stopPropagation()}>
            <div className="account-modal-header">
              <div className="account-modal-title">Sign Out</div>
            </div>

            <div className="account-modal-body">
              <p>
                Are you sure you want to sign out? Your session will end and you will be returned to
                the login screen.
              </p>

              <div className="account-modal-actions">
                <button
                  type="button"
                  className="auth-btn auth-btn-secondary"
                  onClick={() => setShowSignOutModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-signout"
                  onClick={handleSignOut}
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
