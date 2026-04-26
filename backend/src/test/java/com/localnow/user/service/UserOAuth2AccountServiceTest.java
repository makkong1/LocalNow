package com.localnow.user.service;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.localnow.user.domain.OAuth2ProviderType;
import com.localnow.user.domain.User;
import com.localnow.user.domain.UserRole;
import com.localnow.user.repository.UserOAuthIdentityRepository;
import com.localnow.user.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class UserOAuth2AccountServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private UserOAuthIdentityRepository oauthIdentityRepository;

    private UserOAuth2AccountService service;

    @BeforeEach
    void setUp() {
        service = new UserOAuth2AccountService(userRepository, oauthIdentityRepository);
    }

    @Test
    void existingIdentity_returnsLinkedUser() {
        var row = new com.localnow.user.domain.UserOAuthIdentity(9L, OAuth2ProviderType.GOOGLE, "sub-1");
        row.setId(1L);
        when(oauthIdentityRepository.findByProviderAndProviderUserId(OAuth2ProviderType.GOOGLE, "sub-1"))
                .thenReturn(Optional.of(row));
        User u = new User();
        u.setId(9L);
        u.setEmail("a@test.com");
        u.setName("A");
        u.setRole(UserRole.TRAVELER);
        when(userRepository.findById(9L)).thenReturn(Optional.of(u));

        User out = service.findOrCreateFromGoogle("sub-1", "a@test.com", "Name");
        assertThat(out.getId()).isEqualTo(9L);
        verify(userRepository, never()).save(any());
        verify(oauthIdentityRepository, never()).save(any());
    }

    @Test
    void newGoogle_noExistingUser_createsUserAndIdentity() {
        when(oauthIdentityRepository.findByProviderAndProviderUserId(OAuth2ProviderType.GOOGLE, "g-sub"))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmail("g@n.com")).thenReturn(Optional.empty());

        User saved = new User();
        saved.setId(2L);
        saved.setEmail("g@n.com");
        saved.setName("G");
        saved.setRole(UserRole.TRAVELER);
        when(userRepository.save(any(User.class))).thenReturn(saved);
        when(oauthIdentityRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        User out = service.findOrCreateFromGoogle("g-sub", "g@n.com", "G name");

        assertThat(out.getId()).isEqualTo(2L);
        var cap = ArgumentCaptor.forClass(com.localnow.user.domain.UserOAuthIdentity.class);
        verify(oauthIdentityRepository).save(cap.capture());
        assertThat(cap.getValue().getProviderUserId()).isEqualTo("g-sub");
    }

    @Test
    void existingPasswordUserSameEmail_addsOauthRow() {
        when(oauthIdentityRepository.findByProviderAndProviderUserId(OAuth2ProviderType.GOOGLE, "g-sub"))
                .thenReturn(Optional.empty());
        User existing = new User();
        existing.setId(3L);
        existing.setEmail("e@test.com");
        existing.setPassword("hash");
        when(userRepository.findByEmail("e@test.com")).thenReturn(Optional.of(existing));

        User out = service.findOrCreateFromGoogle("g-sub", "e@test.com", "E");

        assertThat(out.getId()).isEqualTo(3L);
        verify(userRepository, never()).save(any(User.class));
        verify(oauthIdentityRepository).save(any());
    }
}
