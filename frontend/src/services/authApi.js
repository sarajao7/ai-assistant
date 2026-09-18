const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const TOKEN_KEY = 'ensiasd_auth_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  remove: () => localStorage.removeItem(TOKEN_KEY),
  has: () => Boolean(localStorage.getItem(TOKEN_KEY)),
};

/**
 * Handle API error responses consistently
 */
async function handleResponse(response) {
  if (!response.ok) {
    let errorMessage = 'An unexpected error occurred';
    try {
      const data = await response.json();
      if (data.detail) {
        if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail) && data.detail.length > 0) {
          errorMessage = data.detail[0].msg || JSON.stringify(data.detail);
        }
      } else if (data.message) {
        errorMessage = data.message;
      }
    } catch {
      errorMessage = response.statusText || `Request failed (${response.status})`;
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export const authApi = {
  /**
   * Log in user using OAuth2 form data
   */
  async login(email, password) {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await handleResponse(response);
    if (data.access_token) {
      tokenStorage.set(data.access_token);
    }
    return data;
  },

  /**
   * Register a new user
   */
  async register({ name, email, password, role = 'student' }) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email, password, role }),
    });

    return handleResponse(response);
  },

  /**
   * Get authenticated user profile
   */
  async getMe(token = tokenStorage.get()) {
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    return handleResponse(response);
  },

  /**
   * Update profile info (name, email)
   */
  async updateMe({ name, email }, token = tokenStorage.get()) {
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, email }),
    });

    return handleResponse(response);
  },

  /**
   * Change current user's password
   */
  async changePassword({ currentPassword, newPassword }, token = tokenStorage.get()) {
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${API_URL}/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    return handleResponse(response);
  },

  /**
   * Log out on the server and remove local token
   */
  async logout(token = tokenStorage.get()) {
    try {
      if (token) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.warn('Server logout notice:', error);
    } finally {
      tokenStorage.remove();
    }
  },

  /**
   * Request password reset token
   */
  async forgotPassword(email) {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    return handleResponse(response);
  },

  /**
   * Reset password with token
   */
  async resetPassword({ resetToken, newPassword }) {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reset_token: resetToken,
        new_password: newPassword,
      }),
    });

    return handleResponse(response);
  },
};
