package com.localnow.user.repository;

import com.localnow.user.domain.OAuth2ProviderType;
import com.localnow.user.domain.UserOAuthIdentity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserOAuthIdentityRepository extends JpaRepository<UserOAuthIdentity, Long> {

    Optional<UserOAuthIdentity> findByProviderAndProviderUserId(
            OAuth2ProviderType provider,
            String providerUserId);
}
