import { useState, useEffect } from 'react';
import { getToken, setToken, clearToken } from '../lib/secure-storage';
import { apiClient } from '../lib/api-client';
import type { LoginResponse, UserProfile } from '../types/api';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getToken().then((token) => setIsAuthenticated(!!token));
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const res = await apiClient.post<LoginResponse>('/auth/login', { email, password });
    if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Login failed');
    await setToken(res.data.accessToken);
    setIsAuthenticated(true);
  }

  async function logout(): Promise<void> {
    await clearToken();
    setIsAuthenticated(false);
    setProfile(null);
  }

  async function loadProfile(): Promise<void> {
    const res = await apiClient.get<UserProfile>('/auth/me');
    if (res.success && res.data) setProfile(res.data);
  }

  return { isAuthenticated, profile, login, logout, loadProfile };
}
