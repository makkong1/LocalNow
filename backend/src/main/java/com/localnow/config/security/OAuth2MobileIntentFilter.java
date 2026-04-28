package com.localnow.config.security;

import java.io.IOException;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * {@code /oauth2/authorization/{id}?mobile=1} 로 시작한 OAuth 는 세션에 표시해 두고,
 * 성공/실패 핸들러가 웹 대신 {@code app.oauth2.*-redirect-mobile}(예: {@code localnow://}) 로 보낸다.
 */
@Component
public class OAuth2MobileIntentFilter extends OncePerRequestFilter {

    public static final String SESSION_ATTR_MOBILE = "LOCALNOW_OAUTH2_MOBILE_RETURN";

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        if ("GET".equalsIgnoreCase(request.getMethod())) {
            String path = request.getRequestURI();
            if (path != null && path.startsWith("/oauth2/authorization/")) {
                String m = request.getParameter("mobile");
                if ("1".equals(m) || "true".equalsIgnoreCase(m)) {
                    request.getSession(true).setAttribute(SESSION_ATTR_MOBILE, Boolean.TRUE);
                }
            }
        }
        filterChain.doFilter(request, response);
    }
}
