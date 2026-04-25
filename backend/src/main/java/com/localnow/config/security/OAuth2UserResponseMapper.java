package com.localnow.config.security;

import com.localnow.user.domain.User;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Google {@link org.springframework.security.oauth2.core.user.OAuth2User} + 로컬 {@link User} 를 합쳐
 * 성공 핸들러가 JWT 를 발급하도록 MDC/attributes 에 넣는다.
 */
public final class OAuth2UserResponseMapper {

    public static final String ATTR_LOCAL_USER_ID = "localnowUserId";
    public static final String ATTR_LOCAL_ROLE = "localnowRole";

    private OAuth2UserResponseMapper() {}

    public static OAuth2User toOAuth2UserWithLocalAttributes(OAuth2User googleUser, User local) {
        Map<String, Object> attrs = new HashMap<>(googleUser.getAttributes());
        attrs.put(ATTR_LOCAL_USER_ID, local.getId());
        attrs.put(ATTR_LOCAL_ROLE, local.getRole().name());
        return new DefaultOAuth2User(
                List.of(new SimpleGrantedAuthority("ROLE_" + local.getRole().name())),
                attrs,
                "sub"
        );
    }
}
