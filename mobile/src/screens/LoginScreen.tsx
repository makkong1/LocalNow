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
import { useTranslation } from 'react-i18next';
import { openBackendOAuth2 } from '../lib/oauth-redirect';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../hooks/useAuth';
import type { AuthStackParamList } from '../navigation/AuthNavigator';
import {
  changeLanguage,
  SUPPORTED_LANGUAGES,
  LANGUAGE_DISPLAY_NAMES,
  type SupportedLanguage,
} from '../i18n';

type LoginNavProp = StackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginNavProp>();
  const { t, i18n } = useTranslation();
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

  const resolvedBase = (i18n.resolvedLanguage ?? i18n.language ?? 'ko').split('-')[0];
  const currentLang = (
    SUPPORTED_LANGUAGES.includes(resolvedBase as SupportedLanguage) ? resolvedBase : 'ko'
  ) as SupportedLanguage;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>LocalNow</Text>
      <View style={styles.langCompactRow}>
        {SUPPORTED_LANGUAGES.map((lang, index) => (
          <React.Fragment key={lang}>
            {index > 0 ? <Text style={styles.langSep}> · </Text> : null}
            <TouchableOpacity onPress={() => void changeLanguage(lang)} testID={`login-lang-${lang}`}>
              <Text
                style={[
                  styles.langCompactLabel,
                  currentLang === lang && styles.langCompactLabelActive,
                ]}
              >
                {LANGUAGE_DISPLAY_NAMES[lang]}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>
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
      <Text style={styles.oauthHint}>{t('auth.oauthHint')}</Text>
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
        placeholder={t('auth.password')}
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
          <Text style={styles.buttonText}>{t('auth.login')}</Text>
        )}
      </TouchableOpacity>
      <View style={styles.recoveryRow}>
        <TouchableOpacity onPress={() => navigation.navigate('EmailHint')} testID="email-hint-link">
          <Text style={styles.linkMuted}>{t('auth.emailHint')}</Text>
        </TouchableOpacity>
        <Text style={styles.recoverySep}> · </Text>
        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} testID="forgot-password-link">
          <Text style={styles.linkMuted}>{t('auth.forgotPassword')}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => navigation.navigate('Signup')} testID="signup-link">
        <Text style={styles.link}>{t('auth.signup')}</Text>
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
    marginBottom: 12,
    textAlign: 'center',
  },
  langCompactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  langSep: {
    color: '#525252',
    fontSize: 13,
  },
  langCompactLabel: {
    color: '#a3a3a3',
    fontSize: 13,
  },
  langCompactLabelActive: {
    color: '#f59e0b',
    fontWeight: '600',
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
  recoveryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  recoverySep: {
    color: '#525252',
    fontSize: 13,
  },
  linkMuted: {
    color: '#a3a3a3',
    fontSize: 13,
  },
});
