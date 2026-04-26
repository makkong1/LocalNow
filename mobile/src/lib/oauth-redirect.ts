import { Alert, Linking } from 'react-native';

const base = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

/**
 * Spring OAuth2 시작 URL을 시스템 브라우저로 연다. 완료 후 토큰 URL은
 * 백엔드 `app.oauth2.success-redirect` (기본: Next `http://localhost:3000/oauth/callback#access_token=...`).
 * 실제 기기·Expo 에서는 콜백 도메인을 접근 가능한 호스트(예: PC LAN IP)로 맞출 것.
 */
export function openBackendOAuth2(provider: 'google' | 'github'): void {
  if (!base) {
    Alert.alert('설정', 'EXPO_PUBLIC_API_BASE_URL을 .env.local에 설정하세요.');
    return;
  }
  void Linking.openURL(`${base}/oauth2/authorization/${provider}`);
}
