import * as SecureStore from 'expo-secure-store';
import { getToken, setToken, clearToken } from '../lib/secure-storage';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED: 'unlocked',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('secure-storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('setToken → getToken returns same value', async () => {
    const token = 'test-token-abc123';
    mockSecureStore.setItemAsync.mockResolvedValueOnce(undefined);
    mockSecureStore.getItemAsync.mockResolvedValueOnce(token);

    await setToken(token);
    const result = await getToken();

    expect(result).toBe(token);
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      'localnow_access_token',
      token,
      expect.any(Object)
    );
  });

  it('clearToken → getToken returns null', async () => {
    mockSecureStore.deleteItemAsync.mockResolvedValueOnce(undefined);
    mockSecureStore.getItemAsync.mockResolvedValueOnce(null);

    await clearToken();
    const result = await getToken();

    expect(result).toBeNull();
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'localnow_access_token',
      expect.any(Object)
    );
  });
});
