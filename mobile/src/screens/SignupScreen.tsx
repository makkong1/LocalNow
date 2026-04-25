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
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../hooks/useAuth';
import type { AuthStackParamList } from '../navigation/AuthNavigator';
import type { UserRole } from '../types/api';

type SignupNavProp = StackNavigationProp<AuthStackParamList, 'Signup'>;

export default function SignupScreen() {
  const navigation = useNavigation<SignupNavProp>();
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
        <Text style={styles.title}>회원가입</Text>
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
          placeholder="비밀번호 (8자 이상)"
          placeholderTextColor="#525252"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          testID="password-input"
        />
        <TextInput
          style={styles.input}
          placeholder="이름"
          placeholderTextColor="#525252"
          value={name}
          onChangeText={setName}
          testID="name-input"
        />
        <TextInput
          style={styles.input}
          placeholder="도시 (선택)"
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
              여행자
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'GUIDE' && styles.roleBtnActive]}
            onPress={() => setRole('GUIDE')}
            testID="role-guide"
          >
            <Text style={[styles.roleBtnText, role === 'GUIDE' && styles.roleBtnTextActive]}>
              가이드
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
            <Text style={styles.buttonText}>가입하기</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')} testID="login-link">
          <Text style={styles.link}>이미 계정이 있으신가요? 로그인</Text>
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
