package com.localnow.config.security;

import com.localnow.user.domain.OAuth2ProviderType;
import com.localnow.user.service.UserOAuth2AccountService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * <p>Non-OIDC OAuth2(예: GitHub) 전용. Google+openid 는 {@link LocalNowOidcUserService} 를 탄다.
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
        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        if (!"github".equals(registrationId)) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("unsupported_provider", "Only github is supported here", null));
        }
        OAuth2User oAuth2User = super.loadUser(userRequest);
        Object idObj = oAuth2User.getAttribute("id");
        if (idObj == null) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("invalid_user", "GitHub user must have id", null));
        }
        String providerUserId = String.valueOf(idObj);
        String email = oAuth2User.getAttribute("email");
        String login = oAuth2User.getAttribute("login");
        if (!StringUtils.hasText(email) && StringUtils.hasText(login)) {
            email = login + "@users.noreply.github.com";
        }
        if (!StringUtils.hasText(email)) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("invalid_user", "GitHub user must have email or public login", null));
        }
        String name = oAuth2User.getAttribute("name");
        try {
            var user = userOAuth2AccountService.findOrCreateForOAuth(
                    OAuth2ProviderType.GITHUB, providerUserId, email, name);
            return OAuth2UserResponseMapper.toOAuth2UserWithLocalAttributes(oAuth2User, user, "id");
        } catch (OAuth2AuthenticationException e) {
            throw e;
        } catch (Exception e) {
            log.error("reason=GITHUB_LOCAL_USER_UPSERT_FAILED ko=GitHub 사용자 로컬 계정 조회/생성 실패 providerUserId={} email={}",
                    providerUserId, email, e);
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("user_service_error", "Internal error while processing GitHub login", null));
        }
    }
}
