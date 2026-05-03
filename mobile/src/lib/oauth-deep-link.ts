import type { UserRole } from "../types/api";

/** Safari → 앱 복귀 URL 인지 (scheme 은 app.json 과 동일하게 localnow) */
export function isOAuthReturnUrl(url: string): boolean {
  const u = url.toLowerCase();
  return u.startsWith("localnow://") && u.includes("oauth/callback");
}

export type OAuthReturnParsed =
  | { kind: "token"; accessToken: string }
  | { kind: "error"; oauth2Error: string };

export function parseOAuthReturnUrl(url: string): OAuthReturnParsed | null {
  if (!isOAuthReturnUrl(url)) {
    return null;
  }
  const hashIdx = url.indexOf("#");
  if (hashIdx !== -1) {
    const hash = url.slice(hashIdx + 1);
    const params = new URLSearchParams(hash);
    const raw = params.get("access_token");
    if (raw) {
      return { kind: "token", accessToken: decodeURIComponent(raw) };
    }
  }
  const qIdx = url.indexOf("?");
  if (qIdx !== -1) {
    const qs = url.slice(qIdx + 1).split("#")[0];
    const params = new URLSearchParams(qs);
    const err = params.get("oauth2Error");
    if (params.get("error") === "1" || err) {
      return {
        kind: "error",
        oauth2Error: err ? decodeURIComponent(err) : "oauth2_failed",
      };
    }
  }
  return null;
}

/** JWT payload 만 읽음(서명 검증 없음). OAuth 리다이렉트 직후 동일 issuer 토큰이므로 클라이언트 표시용. */
export function readUserFromAccessTokenJwt(
  token: string
): { userId: number; role: UserRole } | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = payload.length % 4;
    const padded = pad === 0 ? payload : payload + "=".repeat(4 - pad);
    const json = JSON.parse(atob(padded)) as { sub?: string; role?: string };
    const sub = json.sub;
    const role = json.role;
    if (sub === undefined || role === undefined) {
      return null;
    }
    const userId = parseInt(String(sub), 10);
    if (Number.isNaN(userId)) {
      return null;
    }
    if (role !== "TRAVELER" && role !== "GUIDE" && role !== "ADMIN") {
      return null;
    }
    return { userId, role: role as UserRole };
  } catch {
    return null;
  }
}
