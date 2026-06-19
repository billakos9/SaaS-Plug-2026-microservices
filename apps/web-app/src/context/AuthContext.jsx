import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  getUserFromToken,
  login as loginRequest,
  logout as logoutRequest,
} from '../services/auth';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize session directly from storage before first render if possible
  useEffect(() => {
    const initSession = async () => {
      const tokenUser = getUserFromToken();
      if (tokenUser) {
        setUser(tokenUser);
        try {
          const profile = await getCurrentUser();
          if (profile) setUser({
            ...profile,
            // providerName lives only in the JWT — user-service doesn't return it
            providerName: profile.providerName || tokenUser.providerName,
          });
        } catch (err) {
          console.warn('[Auth] Initial profile fetch failed', err);
        }
      }
      setLoading(false);
    };
    initSession();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const loggedInUser = await loginRequest(email, password);
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err) {
      console.error('[Auth] Login failed', err);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      isProvider: user?.role === 'provider',
      login,
      logout,
      setUser,
    }),
    [loading, user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
