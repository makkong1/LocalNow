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
 * Google 등 OAuth 주체-식별(sub)을 {@link User} 와 1:1(식별) 관계로 연결한다. 추후 provider 추가 시
 * {@link OAuth2ProviderType} / 동일 흐름을 재사용한다.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class UserOAuth2AccountService {

        private final UserRepository userRepository;
        private final UserOAuthIdentityRepository oauthIdentityRepository;

        @Transactional
        public User findOrCreateFromGoogle(
                        String googleSub,
                        String email,
                        String displayName) {
                if (!StringUtils.hasText(googleSub) || !StringUtils.hasText(email)) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST, "Google account must have sub and email");
                }

                return oauthIdentityRepository
                                .findByProviderAndProviderUserId(OAuth2ProviderType.GOOGLE, googleSub)
                                .map(row -> userRepository
                                                .findById(Objects.requireNonNull(row.getUserId(), "userId"))
                                                .orElseThrow(() -> new ResponseStatusException(
                                                                HttpStatus.INTERNAL_SERVER_ERROR,
                                                                "Orphaned OAuth identity row")))
                                .orElseGet(() -> linkNewGoogleIdentity(googleSub, email, displayName));
        }

        private User linkNewGoogleIdentity(String googleSub, String email, String displayName) {
                String name = StringUtils.hasText(displayName)
                                ? displayName.trim()
                                : email.substring(0, email.indexOf('@'));

                var existing = userRepository.findByEmail(email);
                if (existing.isPresent()) {
                        User u = existing.get();
                        oauthIdentityRepository.save(
                                        new UserOAuthIdentity(u.getId(), OAuth2ProviderType.GOOGLE, googleSub));
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
                                new UserOAuthIdentity(created.getId(), OAuth2ProviderType.GOOGLE, googleSub));
                return created;
        }
}
