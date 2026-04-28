import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getToken,
  setToken,
  clearToken,
  getUserId,
  setUserId,
  clearUserId,
  getUserRole,
  setUserRole,
  clearUserRole,
} from '../lib/secure-storage';
import { apiFetch } from '../lib/api-client';
import type { ApiError, AuthResponse, SignupParams, UserRole } from '../types/api';

interface AuthState {
  isLoading: boolean;
  isLoggedIn: boolean;
  userId: number | null;
  role: UserRole | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<ApiError | null>;
  signup: (params: SignupParams) => Promise<ApiError | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isLoggedIn: false,
    userId: null,
    role: null,
  });

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        const [userId, role] = await Promise.all([getUserId(), getUserRole()]);
        setState({ isLoading: false, isLoggedIn: true, userId, role });
      } else {
        setState({ isLoading: false, isLoggedIn: false, userId: null, role: null });
      }
    })();
  }, []);

  async function login(email: string, password: string): Promise<ApiError | null> {
    const res = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      requiresAuth: false,
    });
    if (!res.success || !res.data) {
      return res.error ?? { code: 'INTERNAL_ERROR', message: '로그인에 실패했습니다.', fields: null };
    }
    await Promise.all([
      setToken(res.data.accessToken),
      setUserId(res.data.userId),
      setUserRole(res.data.role),
    ]);
    setState({ isLoading: false, isLoggedIn: true, userId: res.data.userId, role: res.data.role });
    return null;
  }

  async function signup(params: SignupParams): Promise<ApiError | null> {
    const res = await apiFetch<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: params,
      requiresAuth: false,
    });
    if (!res.success) {
      return res.error ?? { code: 'INTERNAL_ERROR', message: '회원가입에 실패했습니다.', fields: null };
    }
    return null;
  }

  async function logout(): Promise<void> {
    await Promise.all([clearToken(), clearUserId(), clearUserRole()]);
    setState({ isLoading: false, isLoggedIn: false, userId: null, role: null });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be called inside AuthProvider');
  return ctx;
}
