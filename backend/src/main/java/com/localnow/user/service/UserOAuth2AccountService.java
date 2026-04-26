package com.localnow.user.service;

import java.math.BigDecimal;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import com.localnow.user.domain.OAuth2ProviderType;
import com.localnow.user.domain.User;
import com.localnow.user.domain.UserOAuthIdentity;
import com.localnow.user.domain.UserRole;
import com.localnow.user.repository.UserOAuthIdentityRepository;
import com.localnow.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * OAuth 주체-식별(provider + provider_user_id)을 {@link User} 와 연결한다.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class UserOAuth2AccountService {

    private final UserRepository userRepository;
    private final UserOAuthIdentityRepository oauthIdentityRepository;

    @Transactional
    public User findOrCreateFromGoogle(String googleSub, String email, String displayName) {
        return findOrCreateForOAuth(OAuth2ProviderType.GOOGLE, googleSub, email, displayName);
    }

    /**
     * @param email 항상 비어 있지 않은 값(예: GitHub noreply 합성은 호출 측에서 수행)
     */
    @Transactional
    public User findOrCreateForOAuth(
            OAuth2ProviderType provider,
            String providerUserId,
            String email,
            String displayName) {
        if (!StringUtils.hasText(providerUserId) || !StringUtils.hasText(email)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "OAuth account must have provider user id and email");
        }

        return oauthIdentityRepository
                .findByProviderAndProviderUserId(provider, providerUserId)
                .map(row -> userRepository
                        .findById(Objects.requireNonNull(row.getUserId(), "userId"))
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.INTERNAL_SERVER_ERROR, "Orphaned OAuth identity row")))
                .orElseGet(() -> linkNewOAuthIdentity(provider, providerUserId, email, displayName));
    }

    private User linkNewOAuthIdentity(
            OAuth2ProviderType provider,
            String providerUserId,
            String email,
            String displayName) {
        String name = StringUtils.hasText(displayName)
                ? displayName.trim()
                : email.substring(0, email.indexOf('@'));

        var existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            User u = existing.get();
            oauthIdentityRepository.save(
                    new UserOAuthIdentity(u.getId(), provider, providerUserId));
            return u;
        }

        User created = new User();
        created.setEmail(email);
        created.setPassword(null);
        created.setName(name);
        created.setRole(UserRole.TRAVELER);
        created.setAvgRating(BigDecimal.ZERO);
        created.setRatingCount(0);
        created = userRepository.save(created);
        oauthIdentityRepository.save(
                new UserOAuthIdentity(created.getId(), provider, providerUserId));
        return created;
    }
}
