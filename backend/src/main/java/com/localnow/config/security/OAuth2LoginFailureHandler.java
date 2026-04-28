package com.localnow.config.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Google OAuth 실패(사용자 취소, 설정 오류 등) 시 앱 쪽으로 보낸다. query 에만 오류 힌트를 둔다(토큰 없음).
 */
@Component
public class OAuth2LoginFailureHandler extends SimpleUrlAuthenticationFailureHandler {

    @Value("${app.oauth2.failure-redirect}")
    private String failureRedirect;

    @Value("${app.oauth2.failure-redirect-mobile}")
    private String failureRedirectMobile;

    @Override
    public void onAuthenticationFailure(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception) throws IOException {
        String base = resolveFailureBase(request);
        String msg = exception.getMessage() != null ? exception.getMessage() : "oauth2_failed";
        String enc = URLEncoder.encode(msg, StandardCharsets.UTF_8);
        String sep = base.contains("?") ? "&" : "?";
        getRedirectStrategy().sendRedirect(request, response, base + sep + "oauth2Error=" + enc);
    }

    private String resolveFailureBase(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        boolean mobile = false;
        if (session != null) {
            Object v = session.getAttribute(OAuth2MobileIntentFilter.SESSION_ATTR_MOBILE);
            session.removeAttribute(OAuth2MobileIntentFilter.SESSION_ATTR_MOBILE);
            mobile = Boolean.TRUE.equals(v);
        }
        if (mobile) {
            return StringUtils.hasText(failureRedirectMobile)
                    ? failureRedirectMobile
                    : "localnow://oauth/callback?error=1";
        }
        return StringUtils.hasText(failureRedirect) ? failureRedirect : "http://localhost:3000/oauth/callback?error=1";
    }
}
