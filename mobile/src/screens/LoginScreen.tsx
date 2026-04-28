import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { openBackendOAuth2 } from '../lib/oauth-redirect';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../hooks/useAuth';
import type { AuthStackParamList } from '../navigation/AuthNavigator';

type LoginNavProp = StackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginNavProp>();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const err = await login(email, password);
    setLoading(false);
    if (err) {
      setError(err.message);
    }
    // On success isLoggedIn becomes true → RootNavigator switches to AppNavigator
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>LocalNow</Text>
      <View style={styles.oauthRow}>
        <TouchableOpacity
          style={styles.oauthBtn}
          onPress={() => openBackendOAuth2('google')}
          testID="oauth-google"
        >
          <Text style={styles.oauthBtnText}>Google</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.oauthBtn}
          onPress={() => openBackendOAuth2('github')}
          testID="oauth-github"
        >
          <Text style={styles.oauthBtnText}>GitHub</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.oauthHint}>
        소셜 로그인은 브라우저로 열리며, 완료 URL은 success-redirect 설정을 따릅니다.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="이메일"
        placeholderTextColor="#525252"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        testID="email-input"
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        placeholderTextColor="#525252"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        testID="password-input"
      />
      {error ? <Text style={styles.error} testID="error-message">{error}</Text> : null}
      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
        testID="login-button"
      >
        {loading ? (
          <ActivityIndicator color="#0a0a0a" />
        ) : (
          <Text style={styles.buttonText}>로그인</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Signup')} testID="signup-link">
        <Text style={styles.link}>회원가입</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    padding: 24,
  },
  oauthRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  oauthBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#141414',
  },
  oauthBtnText: {
    color: '#e5e5e5',
    fontSize: 14,
  },
  oauthHint: {
    color: '#737373',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#0a0a0a',
    fontWeight: '500',
    fontSize: 14,
  },
  link: {
    color: '#f59e0b',
    textAlign: 'center',
    fontSize: 14,
  },
});
