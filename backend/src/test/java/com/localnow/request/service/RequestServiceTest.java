package com.localnow.request.service;

import com.localnow.infra.rabbit.RabbitPublisher;
import com.localnow.infra.redis.RedisGeoService;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.domain.RequestType;
import com.localnow.request.dto.CreateRequestRequest;
import com.localnow.request.dto.HelpRequestResponse;
import com.localnow.request.event.MatchDispatchEvent;
import com.localnow.request.repository.HelpRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RequestServiceTest {

    @Mock
    private HelpRequestRepository repository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private RedisGeoService redisGeoService;

    @Mock
    private RabbitPublisher rabbitPublisher;

    private RequestService requestService;
    private MatchDispatcher matchDispatcher;

    @BeforeEach
    void setUp() {
        requestService = new RequestService(repository, eventPublisher);
        matchDispatcher = new MatchDispatcher(redisGeoService, rabbitPublisher);
    }

    @Test
    void createRequest_success_status_is_open_and_travelerId_matches() {
        CreateRequestRequest req = new CreateRequestRequest(
                RequestType.GUIDE, 37.5665, 126.9780, "Help needed",
                LocalDateTime.now().plusHours(1), 60, 10000L);

        HelpRequest saved = buildRequest(1L, 42L, RequestType.GUIDE, HelpRequestStatus.OPEN, 10000L);
        when(repository.save(any(HelpRequest.class))).thenReturn(saved);

        HelpRequestResponse response = requestService.createRequest(42L, req);

        assertThat(response.status()).isEqualTo(HelpRequestStatus.OPEN);
        assertThat(response.travelerId()).isEqualTo(42L);
    }

    @Test
    void createRequest_publishes_match_dispatch_event_after_save() {
        CreateRequestRequest req = new CreateRequestRequest(
                RequestType.GUIDE, 37.5665, 126.9780, null,
                LocalDateTime.now().plusHours(1), 60, 5000L);

        HelpRequest saved = buildRequest(1L, 42L, RequestType.GUIDE, HelpRequestStatus.OPEN, 5000L);
        when(repository.save(any(HelpRequest.class))).thenReturn(saved);

        requestService.createRequest(42L, req);

        ArgumentCaptor<MatchDispatchEvent> captor = ArgumentCaptor.forClass(MatchDispatchEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().requestId()).isEqualTo(1L);
        assertThat(captor.getValue().requestType()).isEqualTo("GUIDE");
    }

    @Test
    void matchDispatcher_publishes_to_rabbit_when_guides_found() {
        when(redisGeoService.searchNearby(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(10L, 20L));

        matchDispatcher.onMatchDispatch(new MatchDispatchEvent(1L, "GUIDE", 37.5665, 126.9780, 5000L));

        verify(rabbitPublisher).publish(eq("match.offer.created"), any());
    }

    @Test
    void matchDispatcher_skips_publish_when_no_guides_nearby() {
        when(redisGeoService.searchNearby(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of());

        matchDispatcher.onMatchDispatch(new MatchDispatchEvent(1L, "GUIDE", 37.5665, 126.9780, 5000L));

        verify(rabbitPublisher, never()).publish(any(), any());
    }

    @Test
    void createRequest_zero_budget_is_allowed() {
        CreateRequestRequest req = new CreateRequestRequest(
                RequestType.FOOD, 37.5665, 126.9780, null,
                LocalDateTime.now().plusHours(1), 30, 0L);

        HelpRequest saved = buildRequest(2L, 10L, RequestType.FOOD, HelpRequestStatus.OPEN, 0L);
        when(repository.save(any(HelpRequest.class))).thenReturn(saved);

        HelpRequestResponse response = requestService.createRequest(10L, req);

        assertThat(response.budgetKrw()).isEqualTo(0L);
        assertThat(response.status()).isEqualTo(HelpRequestStatus.OPEN);
    }

    @Test
    void getRequest_not_found_throws_404() {
        when(repository.findById(anyLong())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> requestService.getRequest(999L))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    private HelpRequest buildRequest(Long id, Long travelerId, RequestType type,
                                     HelpRequestStatus status, long budgetKrw) {
        HelpRequest r = new HelpRequest();
        r.setId(id);
        r.setTravelerId(travelerId);
        r.setRequestType(type);
        r.setLat(37.5665);
        r.setLng(126.9780);
        r.setStartAt(LocalDateTime.now().plusHours(1));
        r.setDurationMin(60);
        r.setBudgetKrw(budgetKrw);
        r.setStatus(status);
        return r;
    }
}
