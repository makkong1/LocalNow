package com.localnow.user.service;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import com.localnow.user.domain.User;
import com.localnow.user.domain.UserRole;
import com.localnow.user.dto.BaseLocationResponse;
import com.localnow.user.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class GuideProfileServiceTest {

    @Mock
    private UserRepository userRepository;

    private GuideProfileService service;

    @BeforeEach
    void setUp() {
        service = new GuideProfileService(userRepository);
    }

    @Test
    void saveBaseLocation_persists_lat_lng() {
        User guide = buildGuide(10L, null, null);
        when(userRepository.findById(10L)).thenReturn(Optional.of(guide));

        service.saveBaseLocation(10L, 37.5665, 126.978);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        // @Transactional dirty-check; save is not called explicitly — verify field update
        assertThat(guide.getBaseLat()).isEqualTo(37.5665);
        assertThat(guide.getBaseLng()).isEqualTo(126.978);
    }

    @Test
    void saveBaseLocation_throws_when_guide_not_found() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.saveBaseLocation(99L, 37.0, 127.0))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void getBaseLocation_returns_response_when_set() {
        User guide = buildGuide(10L, 37.5665, 126.978);
        when(userRepository.findById(10L)).thenReturn(Optional.of(guide));

        Optional<BaseLocationResponse> result = service.getBaseLocation(10L);

        assertThat(result).isPresent();
        assertThat(result.get().lat()).isEqualTo(37.5665);
        assertThat(result.get().lng()).isEqualTo(126.978);
    }

    @Test
    void getBaseLocation_returns_empty_when_not_set() {
        User guide = buildGuide(10L, null, null);
        when(userRepository.findById(10L)).thenReturn(Optional.of(guide));

        Optional<BaseLocationResponse> result = service.getBaseLocation(10L);

        assertThat(result).isEmpty();
    }

    private User buildGuide(Long id, Double baseLat, Double baseLng) {
        User user = new User();
        user.setId(id);
        user.setEmail("guide" + id + "@test.com");
        user.setName("Guide " + id);
        user.setRole(UserRole.GUIDE);
        user.setBaseLat(baseLat);
        user.setBaseLng(baseLng);
        return user;
    }
}
