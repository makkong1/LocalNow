package com.localnow.config.security;

import com.localnow.user.service.UserOAuth2AccountService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;

/**
 * Google UserInfo 를 불러온 뒤, 로컬 {@code users} + {@code user_oauth_identities} 와 맞춘
 * {@link org.springframework.security.oauth2.core.user.OAuth2User} 를 만든다.
 */
@Component
public class LocalNowOAuth2UserService extends DefaultOAuth2UserService {

    private static final Logger log = LoggerFactory.getLogger(LocalNowOAuth2UserService.class);

    private final UserOAuth2AccountService userOAuth2AccountService;

    public LocalNowOAuth2UserService(UserOAuth2AccountService userOAuth2AccountService) {
        this.userOAuth2AccountService = userOAuth2AccountService;
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) {
        if (!"google".equals(userRequest.getClientRegistration().getRegistrationId())) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("unsupported_provider", "Only google is supported", null));
        }
        OAuth2User oAuth2User = super.loadUser(userRequest);
        String sub = oAuth2User.getAttribute("sub");
        String email = oAuth2User.getAttribute("email");
        String name = oAuth2User.getAttribute("name");
        if (sub == null || email == null) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("invalid_user", "Google user must have sub and email", null));
        }
        try {
            var user = userOAuth2AccountService.findOrCreateFromGoogle(sub, email, name);
            return OAuth2UserResponseMapper.toOAuth2UserWithLocalAttributes(oAuth2User, user);
        } catch (OAuth2AuthenticationException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to find or create local user for Google sub={} email={}", sub, email, e);
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("user_service_error", "Internal error while processing Google login", null));
        }
    }
}
