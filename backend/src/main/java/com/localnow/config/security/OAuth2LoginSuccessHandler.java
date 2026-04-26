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

    @Value("${app.oauth2.failure-redirect}")
    private String failureRedirect;

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
            log.error("OAuth2 principal missing local attributes: uid={} role={} attrs={}",
                    uid, role, oAuth2User.getAttributes().keySet());
            // sendError(500) 는 /error 로 ERROR dispatch → 인증 302 루프를 피하고 실패 콜백으로 보낸다
            String base = StringUtils.hasText(failureRedirect)
                    ? failureRedirect
                    : "http://localhost:3000/oauth/callback?error=1";
            String enc = URLEncoder.encode("invalid_oauth2_principal", StandardCharsets.UTF_8);
            String sep = base.contains("?") ? "&" : "?";
            getRedirectStrategy().sendRedirect(request, response, base + sep + "oauth2Error=" + enc);
            return;
        }
        log.debug("OAuth2 login success: userId={} role={}", uid, role);
        String token = jwtProvider.generateToken((Long) uid, (String) role);
        String enc = URLEncoder.encode(token, StandardCharsets.UTF_8);
        String base = StringUtils.hasText(successRedirect) ? successRedirect : "http://localhost:3000/oauth/callback";
        String target = base + (base.contains("#") ? "&" : "#") + "access_token=" + enc;
        getRedirectStrategy().sendRedirect(request, response, target);
    }
}
