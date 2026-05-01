package com.localnow.config.security;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/**
 * Google 로그인 성공 후, 앱(웹/모바일 웹뷰)이 받을 URL 로 리다이렉트하며
 * URL fragment(#) 에 {@code access_token} 을 둬 서버/프록시 access 로그에 토큰이 남지 않게 한다.
 * 클라이언트는 fragment 를 파싱한 뒤 {@code Authorization: Bearer} 로 API 를 호출한다.
 */
@Component
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2LoginSuccessHandler.class);

    private final JwtProvider jwtProvider;

    @Value("${app.oauth2.success-redirect}")
    private String successRedirect;

    @Value("${app.oauth2.success-redirect-mobile}")
    private String successRedirectMobile;

    @Value("${app.oauth2.failure-redirect}")
    private String failureRedirect;

    @Value("${app.oauth2.failure-redirect-mobile}")
    private String failureRedirectMobile;

    public OAuth2LoginSuccessHandler(JwtProvider jwtProvider) {
        this.jwtProvider = jwtProvider;
    }

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) throws IOException {
        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        Object uid = oAuth2User.getAttribute(OAuth2UserResponseMapper.ATTR_LOCAL_USER_ID);
        Object role = oAuth2User.getAttribute(OAuth2UserResponseMapper.ATTR_LOCAL_ROLE);
        if (uid == null || role == null) {
            log.error("reason=OAUTH2_PRINCIPAL_ATTR_MISSING ko=OAuth2 인증 사용자 로컬 속성 누락 uid={} role={} attrs={}",
                    uid, role, oAuth2User.getAttributes().keySet());
            // sendError(500) 는 /error 로 ERROR dispatch → 인증 302 루프를 피하고 실패 콜백으로 보낸다
            String base = resolveFailureBase(request);
            String enc = URLEncoder.encode("invalid_oauth2_principal", StandardCharsets.UTF_8);
            String sep = base.contains("?") ? "&" : "?";
            getRedirectStrategy().sendRedirect(request, response, base + sep + "oauth2Error=" + enc);
            return;
        }
        log.debug("reason=OAUTH2_LOGIN_SUCCESS ko=OAuth2 로그인 성공 userId={} role={}", uid, role);
        String token = jwtProvider.generateToken((Long) uid, (String) role);
        String enc = URLEncoder.encode(token, StandardCharsets.UTF_8);
        String base = resolveSuccessBase(request);
        String target = base + (base.contains("#") ? "&" : "#") + "access_token=" + enc;
        getRedirectStrategy().sendRedirect(request, response, target);
    }

    private boolean consumeMobileReturn(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return false;
        }
        Object v = session.getAttribute(OAuth2MobileIntentFilter.SESSION_ATTR_MOBILE);
        session.removeAttribute(OAuth2MobileIntentFilter.SESSION_ATTR_MOBILE);
        return Boolean.TRUE.equals(v);
    }

    private String resolveSuccessBase(HttpServletRequest request) {
        if (consumeMobileReturn(request)) {
            return StringUtils.hasText(successRedirectMobile)
                    ? successRedirectMobile
                    : "localnow://oauth/callback";
        }
        return StringUtils.hasText(successRedirect) ? successRedirect : "http://localhost:3000/oauth/callback";
    }

    private String resolveFailureBase(HttpServletRequest request) {
        if (consumeMobileReturn(request)) {
            return StringUtils.hasText(failureRedirectMobile)
                    ? failureRedirectMobile
                    : "localnow://oauth/callback?error=1";
        }
        return StringUtils.hasText(failureRedirect) ? failureRedirect : "http://localhost:3000/oauth/callback?error=1";
    }
}
