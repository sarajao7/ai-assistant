import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, tokenStorage } from '../services/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => tokenStorage.get());
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Hydrate user on mount if token exists
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      const storedToken = tokenStorage.get();
      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const userData = await authApi.getMe(storedToken);
        if (isMounted) {
          setUser(userData);
          setToken(storedToken);
        }
      } catch (error) {
        console.warn('Session expired or invalid token:', error);
        tokenStorage.remove();
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setAuthError(null);
    const data = await authApi.login(email, password);
    const accessToken = data.access_token;
    setToken(accessToken);

    // Fetch user profile immediately
    const profile = await authApi.getMe(accessToken);
    setUser(profile);
    return profile;
  }, []);

  const register = useCallback(async (userData) => {
    setAuthError(null);
    return authApi.register(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout(token);
    } finally {
      tokenStorage.remove();
      setUser(null);
      setToken(null);
      setAuthError(null);
    }
  }, [token]);

  const updateProfile = useCallback(async (name, email) => {
    const response = await authApi.updateMe({ name, email }, token);
    if (response && response.user) {
      setUser(response.user);
    } else {
      // Refresh to ensure in sync
      const freshUser = await authApi.getMe(token);
      setUser(freshUser);
    }
    return response;
  }, [token]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    return authApi.changePassword({ currentPassword, newPassword }, token);
  }, [token]);

  const refreshUser = useCallback(async () => {
    if (!token) return null;
    try {
      const fresh = await authApi.getMe(token);
      setUser(fresh);
      return fresh;
    } catch (err) {
      console.warn('Failed to refresh user:', err);
      return null;
    }
  }, [token]);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    authError,
    setAuthError,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
