package com.localnow.request.service;

import com.localnow.common.ErrorCode;
import com.localnow.match.repository.MatchOfferRepository;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.dto.CreateRequestRequest;
import com.localnow.request.dto.HelpRequestPageResponse;
import com.localnow.request.dto.HelpRequestResponse;
import com.localnow.request.event.MatchDispatchEvent;
import com.localnow.request.repository.HelpRequestRepository;
import com.localnow.user.domain.UserRole;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class RequestService {

    private final HelpRequestRepository repository;
    private final ApplicationEventPublisher eventPublisher;
    private final MatchOfferRepository matchOfferRepository;

    public RequestService(
            HelpRequestRepository repository,
            ApplicationEventPublisher eventPublisher,
            MatchOfferRepository matchOfferRepository) {
        this.repository = repository;
        this.eventPublisher = eventPublisher;
        this.matchOfferRepository = matchOfferRepository;
    }

    @Transactional
    public HelpRequestResponse createRequest(Long travelerId, CreateRequestRequest req) {
        HelpRequest request = new HelpRequest();
        request.setTravelerId(travelerId);
        request.setRequestType(req.requestType());
        request.setLat(req.lat());
        request.setLng(req.lng());
        request.setDescription(req.description());
        request.setStartAt(req.startAt());
        request.setDurationMin(req.durationMin());
        request.setBudgetKrw(req.budgetKrw());
        request.setStatus(HelpRequestStatus.OPEN);

        HelpRequest saved = repository.save(request);

        // AFTER_COMMIT으로 발행하여 롤백 시 유령 이벤트를 방지한다 (ADR-003)
        eventPublisher.publishEvent(new MatchDispatchEvent(
                saved.getId(), saved.getRequestType().name(),
                saved.getLat(), saved.getLng(), saved.getBudgetKrw()
        ));

        return toResponse(saved);
    }

    public HelpRequestResponse getRequest(Long requestId) {
        HelpRequest request = repository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Help request not found"));
        return toResponse(request);
    }

    public HelpRequestResponse getRequestForUser(Long requestId, Long userId, UserRole role) {
        HelpRequest request = repository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Help request not found"));
        if (role == UserRole.TRAVELER) {
            if (!userId.equals(request.getTravelerId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
            }
        } else if (role == UserRole.GUIDE) {
            if (request.getStatus() == HelpRequestStatus.OPEN) {
                return toResponse(request);
            }
            if (!matchOfferRepository.existsByRequestIdAndGuideId(requestId, userId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
            }
        } else {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
        }
        return toResponse(request);
    }

    public HelpRequestPageResponse getOpenRequests(Long cursor, int size) {
        PageRequest pageable = PageRequest.of(0, size + 1);
        List<HelpRequest> items = (cursor == null)
                ? repository.findByStatusOrderByIdDesc(HelpRequestStatus.OPEN, pageable)
                : repository.findByStatusAndIdLessThanOrderByIdDesc(HelpRequestStatus.OPEN, cursor, pageable);

        Long nextCursor = null;
        if (items.size() > size) {
            nextCursor = items.get(size - 1).getId();
            items = items.subList(0, size);
        }

        return new HelpRequestPageResponse(items.stream().map(this::toResponse).toList(), nextCursor);
    }

    public HelpRequestPageResponse getMyRequests(Long travelerId, Long cursor, int size) {
        PageRequest pageable = PageRequest.of(0, size + 1);
        List<HelpRequest> items = (cursor == null)
                ? repository.findByTravelerIdOrderByIdDesc(travelerId, pageable)
                : repository.findByTravelerIdAndIdLessThanOrderByIdDesc(travelerId, cursor, pageable);

        Long nextCursor = null;
        if (items.size() > size) {
            nextCursor = items.get(size - 1).getId();
            items = items.subList(0, size);
        }

        return new HelpRequestPageResponse(items.stream().map(this::toResponse).toList(), nextCursor);
    }

    private HelpRequestResponse toResponse(HelpRequest r) {
        return new HelpRequestResponse(
                r.getId(), r.getTravelerId(), r.getRequestType(),
                r.getLat(), r.getLng(), r.getDescription(),
                r.getStartAt(), r.getDurationMin(), r.getBudgetKrw(),
                r.getStatus(), r.getCreatedAt()
        );
    }
}
