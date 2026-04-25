import * as SecureStore from 'expo-secure-store';
import type { UserRole } from '../types/api';

const TOKEN_KEY = 'localnow_access_token';
const USER_ID_KEY = 'localnow_user_id';
const USER_ROLE_KEY = 'localnow_user_role';

const STORE_OPTS = { keychainAccessible: SecureStore.WHEN_UNLOCKED };

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY, STORE_OPTS);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token, STORE_OPTS);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY, STORE_OPTS);
}

export async function getUserId(): Promise<number | null> {
  const val = await SecureStore.getItemAsync(USER_ID_KEY, STORE_OPTS);
  return val ? parseInt(val, 10) : null;
}

export async function setUserId(id: number): Promise<void> {
  await SecureStore.setItemAsync(USER_ID_KEY, String(id), STORE_OPTS);
}

export async function clearUserId(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_ID_KEY, STORE_OPTS);
}

export async function getUserRole(): Promise<UserRole | null> {
  const val = await SecureStore.getItemAsync(USER_ROLE_KEY, STORE_OPTS);
  return (val as UserRole) ?? null;
}

export async function setUserRole(role: UserRole): Promise<void> {
  await SecureStore.setItemAsync(USER_ROLE_KEY, role, STORE_OPTS);
}

export async function clearUserRole(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_ROLE_KEY, STORE_OPTS);
}
