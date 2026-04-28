import {
  isOAuthReturnUrl,
  parseOAuthReturnUrl,
  readUserFromAccessTokenJwt,
} from '../lib/oauth-deep-link';

describe('oauth-deep-link', () => {
  it('isOAuthReturnUrl', () => {
    expect(isOAuthReturnUrl('localnow://oauth/callback#access_token=x')).toBe(true);
    expect(isOAuthReturnUrl('https://evil/oauth/callback')).toBe(false);
    expect(isOAuthReturnUrl('exp://192.168.1.1:8081')).toBe(false);
  });

  it('parseOAuthReturnUrl token', () => {
    const url = 'localnow://oauth/callback#access_token=abc%2Bdef';
    expect(parseOAuthReturnUrl(url)).toEqual({ kind: 'token', accessToken: 'abc+def' });
  });

  it('parseOAuthReturnUrl error', () => {
    const url = 'localnow://oauth/callback?error=1&oauth2Error=cancelled';
    expect(parseOAuthReturnUrl(url)).toEqual({ kind: 'error', oauth2Error: 'cancelled' });
  });

  it('readUserFromAccessTokenJwt', () => {
    const header = btoa(JSON.stringify({ alg: 'HS256' }));
    const payload = btoa(JSON.stringify({ sub: '42', role: 'TRAVELER' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const token = `${header}.${payload}.sig`;
    expect(readUserFromAccessTokenJwt(token)).toEqual({ userId: 42, role: 'TRAVELER' });
  });
});
