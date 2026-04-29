package com.localnow.config.security;

/**
 * {@link SecurityConfig} 및 WebMvcTest 용 {@code TestSecurityConfig} 가 동일한 permit 을 쓰도록
 * 공개 경로를 한곳에 둔다.
 */
public final class SecurityPathPatterns {

    public static final String[] UNAUTHENTICATED = {
            "/auth/**",
            "/files/**",
            "/actuator/health",
            "/actuator/info",
            "/swagger-ui/**",
            "/v3/api-docs/**",
            "/ws/**",
            "/ws-native/**",
            "/oauth2/**",
            "/login/oauth2/**",
            "/error"
    };

    private SecurityPathPatterns() {}
}
