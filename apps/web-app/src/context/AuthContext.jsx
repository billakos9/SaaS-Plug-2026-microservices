import { createContext, useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    let active = true;
    const tokenUser = getUserFromToken();

    if (!tokenUser) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setUser(tokenUser);

    getCurrentUser()
      .then((profile) => {
        if (active && profile) setUser(profile);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = async (email, password) => {
    const loggedInUser = await loginRequest(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = () => {
    logoutRequest();
    setUser(null);
  };

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
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
