import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import apiClient, { getAccessToken, setAccessToken } from '../services/apiClient';
import type { CurrentUser } from '../types';

interface AuthContextType {
  currentUser: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    apiClient
      .get<{ data: CurrentUser }>('/auth/me')
      .then((res) => setCurrentUser(res.data.data))
      .catch(() => setAccessToken(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await apiClient.post<{ data: { accessToken: string; user: CurrentUser } }>('/auth/login', { identifier, password });
    setAccessToken(res.data.data.accessToken);
    setCurrentUser(res.data.data.user);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    // The backend revokes the current session's refresh token and issues a
    // fresh access token here (the old one still carries mustResetPassword:
    // true baked into its JWT claims) — swap it in immediately.
    const res = await apiClient.post<{ data: { accessToken: string } }>('/auth/change-password', { currentPassword, newPassword });
    setAccessToken(res.data.data.accessToken);
    setCurrentUser((prev) => (prev ? { ...prev, mustResetPassword: false } : prev));
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore — clear local state regardless
    }
    setAccessToken(null);
    setCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: !!currentUser, isLoading, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
