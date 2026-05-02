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
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { openBackendOAuth2 } from '../lib/oauth-redirect';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../hooks/useAuth';
import type { AuthStackParamList } from '../navigation/AuthNavigator';
import type { UserRole } from '../types/api';

type SignupNavProp = StackNavigationProp<AuthStackParamList, 'Signup'>;

export default function SignupScreen() {
  const navigation = useNavigation<SignupNavProp>();
  const { t } = useTranslation();
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('TRAVELER');
  const [city, setCity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setLoading(true);
    setError(null);
    const err = await signup({ email, password, name, role, city: city || undefined });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      navigation.navigate('Login');
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('auth.signup')}</Text>
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
        <Text style={styles.oauthHint}>{t('auth.oauthSignupHint')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          placeholderTextColor="#525252"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          testID="email-input"
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.passwordHint')}
          placeholderTextColor="#525252"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          testID="password-input"
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.name')}
          placeholderTextColor="#525252"
          value={name}
          onChangeText={setName}
          testID="name-input"
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.city')}
          placeholderTextColor="#525252"
          value={city}
          onChangeText={setCity}
          testID="city-input"
        />
        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'TRAVELER' && styles.roleBtnActive]}
            onPress={() => setRole('TRAVELER')}
            testID="role-traveler"
          >
            <Text style={[styles.roleBtnText, role === 'TRAVELER' && styles.roleBtnTextActive]}>
              {t('auth.roleTraveler')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'GUIDE' && styles.roleBtnActive]}
            onPress={() => setRole('GUIDE')}
            testID="role-guide"
          >
            <Text style={[styles.roleBtnText, role === 'GUIDE' && styles.roleBtnTextActive]}>
              {t('auth.roleGuide')}
            </Text>
          </TouchableOpacity>
        </View>
        {error ? <Text style={styles.error} testID="error-message">{error}</Text> : null}
        <TouchableOpacity
          style={styles.button}
          onPress={handleSignup}
          disabled={loading}
          testID="signup-button"
        >
          {loading ? (
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={styles.buttonText}>{t('auth.signupAction')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')} testID="login-link">
          <Text style={styles.link}>{t('auth.alreadyHaveAccount')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 32,
    textAlign: 'center',
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
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  roleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#141414',
  },
  roleBtnActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#451a03',
  },
  roleBtnText: {
    color: '#525252',
    fontSize: 14,
  },
  roleBtnTextActive: {
    color: '#f59e0b',
    fontWeight: '500',
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
