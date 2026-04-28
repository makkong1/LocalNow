import { Alert, Linking } from 'react-native';

function oauthBase(): string {
  return (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
}

/**
 * Spring OAuth2 시작 URL을 시스템 브라우저로 연는다. `mobile=1` 이면 완료 후
 * `localnow://oauth/callback#access_token=...` 로 앱에 복귀한다(백엔드 세션 플래그).
 * 웹만 쓸 때는 브라우저에서 `/oauth2/authorization/{id}` 를 열면 기존처럼 Next 콜백으로 간다.
 */
export function openBackendOAuth2(provider: 'google' | 'github'): void {
  const base = oauthBase();
  if (!base) {
    Alert.alert('설정', 'EXPO_PUBLIC_API_BASE_URL을 .env.local에 설정하세요.');
    return;
  }
  const url = `${base}/oauth2/authorization/${provider}?mobile=1`;
  void Linking.openURL(url).catch(() => {
    Alert.alert(
      '브라우저에서 열지 못했습니다',
      `${url}\n\n• 백엔드 포트는 8080 입니다(.env.local 과 application.yml 일치).\n• 시뮬레이터는 localhost:8080 도 가능합니다.`,
    );
  });
}
