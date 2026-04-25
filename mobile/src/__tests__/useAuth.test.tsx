import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../hooks/useAuth';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED: 'unlocked',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../lib/api-client', () => ({
  apiFetch: jest.fn(),
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import * as SecureStore from 'expo-secure-store';
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureStore.setItemAsync.mockResolvedValue(undefined);
    mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
  });

  it('restores login state from SecureStore on AuthProvider mount', async () => {
    mockSecureStore.getItemAsync.mockImplementation((key: string) => {
      const store: Record<string, string> = {
        localnow_access_token: 'saved-token',
        localnow_user_id: '42',
        localnow_user_role: 'TRAVELER',
      };
      return Promise.resolve(store[key] ?? null);
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.userId).toBe(42);
    expect(result.current.role).toBe('TRAVELER');
  });

  it('clears SecureStore and resets state on logout', async () => {
    mockSecureStore.getItemAsync.mockImplementation((key: string) => {
      const store: Record<string, string> = {
        localnow_access_token: 'token',
        localnow_user_id: '1',
        localnow_user_role: 'GUIDE',
      };
      return Promise.resolve(store[key] ?? null);
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoggedIn).toBe(true);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.userId).toBeNull();
    expect(result.current.role).toBeNull();
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'localnow_access_token',
      expect.any(Object)
    );
  });
});
