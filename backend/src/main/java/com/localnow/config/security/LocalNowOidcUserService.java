package com.localnow.config.security;

import com.localnow.user.service.UserOAuth2AccountService;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Google + {@code openid} 스코프는 <strong>OIDC</strong> 흐름이므로
 * {@link LocalNowOAuth2UserService}({@code OAuth2UserService})가 아닌
 * {@link OidcUserService#loadUser} 가 호출된다. 로컬 {@code users} 연동은 여기서 수행한다.
 */
@Component
public class LocalNowOidcUserService extends OidcUserService {

    private final UserOAuth2AccountService userOAuth2AccountService;

    public LocalNowOidcUserService(UserOAuth2AccountService userOAuth2AccountService) {
        this.userOAuth2AccountService = userOAuth2AccountService;
    }

    @Override
    public OidcUser loadUser(OidcUserRequest userRequest) {
        if (!"google".equals(userRequest.getClientRegistration().getRegistrationId())) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("unsupported_provider", "Only google is supported", null));
        }
        OidcUser oidc = super.loadUser(userRequest);
        String sub = oidc.getSubject();
        String email = oidc.getAttribute("email");
        String name = oidc.getAttribute("name");
        if (sub == null || email == null) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("invalid_user", "Google user must have sub and email", null));
        }
        var user = userOAuth2AccountService.findOrCreateFromGoogle(sub, email, name);
        Map<String, Object> claims = new HashMap<>(oidc.getAttributes());
        claims.put(OAuth2UserResponseMapper.ATTR_LOCAL_USER_ID, user.getId());
        claims.put(OAuth2UserResponseMapper.ATTR_LOCAL_ROLE, user.getRole().name());
        OidcUserInfo userInfo = new OidcUserInfo(claims);
        return new DefaultOidcUser(
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())),
                oidc.getIdToken(),
                userInfo,
                "sub");
    }
}
