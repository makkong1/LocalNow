package com.localnow.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.localnow.admin.dto.AdminSummaryResponse;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.repository.HelpRequestRepository;
import com.localnow.user.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private HelpRequestRepository helpRequestRepository;

    @InjectMocks
    private AdminService adminService;

    @BeforeEach
    void setUp() {
        when(userRepository.count()).thenReturn(10L);
    }

    @Test
    @DisplayName("정상: 모든 상태가 존재하면 각 카운트가 올바르게 매핑된다")
    void 정상_모든_상태_카운트_정상_매핑() {
        List<Object[]> rows = new ArrayList<>();
        rows.add(new Object[]{HelpRequestStatus.OPEN, 3L});
        rows.add(new Object[]{HelpRequestStatus.MATCHED, 2L});
        rows.add(new Object[]{HelpRequestStatus.IN_PROGRESS, 1L});
        rows.add(new Object[]{HelpRequestStatus.COMPLETED, 5L});
        rows.add(new Object[]{HelpRequestStatus.CANCELLED, 0L});
        when(helpRequestRepository.countGroupByStatus()).thenReturn(rows);

        AdminSummaryResponse result = adminService.getSummary();

        assertThat(result.userCount()).isEqualTo(10L);
        assertThat(result.helpRequestsOpen()).isEqualTo(3L);
        assertThat(result.helpRequestsMatched()).isEqualTo(2L);
        assertThat(result.helpRequestsInProgress()).isEqualTo(1L);
        assertThat(result.helpRequestsCompleted()).isEqualTo(5L);
        assertThat(result.helpRequestsCancelled()).isEqualTo(0L);
    }

    @Test
    @DisplayName("경계: 일부 상태가 없으면 해당 카운트는 0으로 반환된다")
    void 경계_일부_상태_없으면_0으로_반환() {
        List<Object[]> rows = new ArrayList<>();
        rows.add(new Object[]{HelpRequestStatus.OPEN, 7L});
        when(helpRequestRepository.countGroupByStatus()).thenReturn(rows);

        AdminSummaryResponse result = adminService.getSummary();

        assertThat(result.helpRequestsOpen()).isEqualTo(7L);
        assertThat(result.helpRequestsMatched()).isEqualTo(0L);
        assertThat(result.helpRequestsInProgress()).isEqualTo(0L);
        assertThat(result.helpRequestsCompleted()).isEqualTo(0L);
        assertThat(result.helpRequestsCancelled()).isEqualTo(0L);
    }

    @Test
    @DisplayName("경계: 요청이 하나도 없으면 모든 카운트가 0이다")
    void 경계_요청_없으면_모든_카운트_0() {
        when(helpRequestRepository.countGroupByStatus()).thenReturn(new ArrayList<>());

        AdminSummaryResponse result = adminService.getSummary();

        assertThat(result.userCount()).isEqualTo(10L);
        assertThat(result.helpRequestsOpen()).isEqualTo(0L);
        assertThat(result.helpRequestsMatched()).isEqualTo(0L);
        assertThat(result.helpRequestsInProgress()).isEqualTo(0L);
        assertThat(result.helpRequestsCompleted()).isEqualTo(0L);
        assertThat(result.helpRequestsCancelled()).isEqualTo(0L);
    }
}
