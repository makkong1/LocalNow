package com.localnow.review.service;

import java.util.List;
import java.util.Objects;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.localnow.common.ErrorCode;
import com.localnow.match.domain.MatchOffer;
import com.localnow.match.domain.MatchOfferStatus;
import com.localnow.match.repository.MatchOfferRepository;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.repository.HelpRequestRepository;
import com.localnow.review.domain.Review;
import com.localnow.review.dto.CreateReviewRequest;
import com.localnow.review.dto.ReviewPageResponse;
import com.localnow.review.dto.ReviewResponse;
import com.localnow.review.repository.ReviewRepository;
import com.localnow.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final HelpRequestRepository helpRequestRepository;
    private final MatchOfferRepository matchOfferRepository;
    private final UserRepository userRepository;

    @Transactional
    public ReviewResponse createReview(Long reviewerId, Long requestId, CreateReviewRequest req) {
        HelpRequest request = helpRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        if (request.getStatus() != HelpRequestStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Request is not completed yet");
        }

        if (!reviewerId.equals(request.getTravelerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
        }

        if (reviewRepository.findByRequestId(requestId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Review already exists");
        }

        // guideId: must find the confirmed guide from match offers
        // For simplicity, we derive revieweeId from the request context
        // The confirmed guide is stored in ChatRoom or MatchOffer
        // We'll look up via MatchOffer
        Long guideId = findConfirmedGuideId(requestId);

        Review review = new Review();
        review.setRequestId(requestId);
        review.setReviewerId(reviewerId);
        review.setRevieweeId(guideId);
        review.setRating(req.rating());
        review.setComment(req.comment());
        Review saved = reviewRepository.save(review);

        updateGuideRating(guideId, req.rating());

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public ReviewPageResponse getReviews(Long revieweeId, Long cursor, int size) {
        PageRequest pageable = PageRequest.of(0, size + 1);
        List<Review> items = (cursor == null)
                ? reviewRepository.findByRevieweeIdOrderByIdDesc(revieweeId, pageable)
                : reviewRepository.findByRevieweeIdAndIdLessThanOrderByIdDesc(revieweeId, cursor, pageable);

        Long nextCursor = null;
        if (items.size() > size) {
            nextCursor = items.get(size - 1).getId();
            items = items.subList(0, size);
        }

        return new ReviewPageResponse(items.stream().map(this::toResponse).toList(), nextCursor);
    }

    private Long findConfirmedGuideId(Long requestId) {
        return matchOfferRepository.findByRequestId(requestId).stream()
                .filter(o -> o.getStatus() == MatchOfferStatus.CONFIRMED)
                .map(MatchOffer::getGuideId)
                .filter(Objects::nonNull)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Confirmed guide not found for request"));
    }

    private void updateGuideRating(Long guideId, int newRating) {
        if (guideId == null) {
            return;
        }
        int updated = userRepository.incrementRating(guideId, newRating);
        if (updated == 0) {
            log.warn("incrementRating: guideId={} not found", guideId);
        }
    }

    private ReviewResponse toResponse(Review r) {
        return new ReviewResponse(r.getId(), r.getRequestId(), r.getRevieweeId(),
                r.getRating(), r.getComment(), r.getCreatedAt());
    }
}
