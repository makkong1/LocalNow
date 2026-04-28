import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { AuthStackParamList } from '../navigation/AuthNavigator';
import { postEmailHintRequest, postEmailHintVerify } from '../lib/recovery-api';

type Nav = StackNavigationProp<AuthStackParamList, 'EmailHint'>;

export default function EmailHintScreen() {
  const navigation = useNavigation<Nav>();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequest() {
    setLoading(true);
    setError(null);
    const res = await postEmailHintRequest({ name: name.trim(), city: city.trim() });
    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.error?.message ?? '요청에 실패했습니다.');
      return;
    }
    setTicketId(res.data.ticketId);
    setStep(2);
    Alert.alert(
      '인증번호 발송',
      '등록된 이메일로 인증번호가 발송되었습니다.\n(개발 환경에서는 서버 콘솔 로그에서 OTP를 확인할 수 있습니다.)',
    );
  }

  async function handleVerify() {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    const res = await postEmailHintVerify({ ticketId, code: code.trim() });
    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.error?.message ?? '인증에 실패했습니다.');
      return;
    }
    Alert.alert('가입 이메일', res.data.email, [
      { text: '확인', onPress: () => navigation.navigate('Login') },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>이메일 찾기</Text>
        <Text style={styles.desc}>
          아이디는 가입 시 사용한 이메일입니다. 가입 시 입력한 이름과 도시가 일치하면 등록 이메일로 인증번호가
          발송됩니다.
        </Text>

        {step === 1 ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="이름"
              placeholderTextColor="#525252"
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="도시 (가입 시 입력)"
              placeholderTextColor="#525252"
              value={city}
              onChangeText={setCity}
              autoCapitalize="none"
            />
          </>
        ) : (
          <>
            <Text style={styles.stepLabel}>인증번호 6자리</Text>
            <TextInput
              style={styles.input}
              placeholder="000000"
              placeholderTextColor="#525252"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {step === 1 ? (
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRequest}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0a0a0a" />
            ) : (
              <Text style={styles.buttonText}>인증번호 받기</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0a0a0a" />
            ) : (
              <Text style={styles.buttonText}>확인 후 이메일 표시</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>로그인으로</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#0a0a0a' },
  container: {
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  desc: {
    fontSize: 13,
    color: '#a3a3a3',
    lineHeight: 20,
    marginBottom: 24,
  },
  stepLabel: {
    fontSize: 12,
    color: '#737373',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: '#0a0a0a',
    fontWeight: '600',
    fontSize: 14,
  },
  link: {
    color: '#f59e0b',
    textAlign: 'center',
    fontSize: 14,
  },
});
