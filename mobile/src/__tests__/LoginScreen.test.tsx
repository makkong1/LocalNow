import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import LoginScreen from '../screens/LoginScreen';

const mockLogin = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    signup: jest.fn(),
    logout: jest.fn(),
    isLoading: false,
    isLoggedIn: false,
    userId: null,
    role: null,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls login with email and password when button is pressed', async () => {
    mockLogin.mockResolvedValueOnce(null);

    const { getByTestId } = render(<LoginScreen />);

    fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'password123');

    await act(async () => {
      fireEvent.press(getByTestId('login-button'));
    });

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('shows error message when login returns an error', async () => {
    const errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
    mockLogin.mockResolvedValueOnce({
      code: 'AUTH_UNAUTHENTICATED',
      message: errorMessage,
      fields: null,
    });

    const { getByTestId, findByTestId } = render(<LoginScreen />);

    fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'wrongpass');

    await act(async () => {
      fireEvent.press(getByTestId('login-button'));
    });

    const errorEl = await findByTestId('error-message');
    expect(errorEl.props.children).toBe(errorMessage);
  });
});
