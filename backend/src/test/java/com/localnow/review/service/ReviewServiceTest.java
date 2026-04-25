package com.localnow.review.service;

import com.localnow.match.domain.MatchOffer;
import com.localnow.match.domain.MatchOfferStatus;
import com.localnow.match.repository.MatchOfferRepository;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.domain.RequestType;
import com.localnow.request.repository.HelpRequestRepository;
import com.localnow.review.domain.Review;
import com.localnow.review.dto.CreateReviewRequest;
import com.localnow.review.dto.ReviewResponse;
import com.localnow.review.repository.ReviewRepository;
import com.localnow.user.domain.User;
import com.localnow.user.domain.UserRole;
import com.localnow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {

    @Mock ReviewRepository reviewRepository;
    @Mock HelpRequestRepository helpRequestRepository;
    @Mock MatchOfferRepository matchOfferRepository;
    @Mock UserRepository userRepository;

    private ReviewService reviewService;

    @BeforeEach
    void setUp() {
        reviewService = new ReviewService(reviewRepository, helpRequestRepository,
                matchOfferRepository, userRepository);
    }

    @Test
    void createReview_succeeds_for_completed_request() {
        HelpRequest request = buildRequest(1L, 10L, HelpRequestStatus.COMPLETED);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));
        when(reviewRepository.findByRequestId(1L)).thenReturn(Optional.empty());

        MatchOffer offer = new MatchOffer();
        offer.setGuideId(20L);
        offer.setStatus(MatchOfferStatus.CONFIRMED);
        when(matchOfferRepository.findByRequestId(1L)).thenReturn(List.of(offer));

        User guide = new User();
        guide.setId(20L);
        guide.setRatingCount(0);
        guide.setAvgRating(BigDecimal.ZERO);
        guide.setRole(UserRole.GUIDE);
        when(userRepository.findById(20L)).thenReturn(Optional.of(guide));

        Review saved = buildReview(1L, 1L, 10L, 20L, 5);
        when(reviewRepository.save(any())).thenReturn(saved);
        when(userRepository.save(any())).thenReturn(guide);

        ReviewResponse response = reviewService.createReview(10L, 1L,
                new CreateReviewRequest(5, "Great guide!"));

        assertThat(response.rating()).isEqualTo(5);
        assertThat(response.revieweeId()).isEqualTo(20L);
    }

    @Test
    void createReview_throws_when_request_is_not_completed() {
        HelpRequest request = buildRequest(1L, 10L, HelpRequestStatus.MATCHED);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));

        assertThatThrownBy(() -> reviewService.createReview(10L, 1L,
                new CreateReviewRequest(4, null)))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void createReview_throws_when_review_already_exists() {
        HelpRequest request = buildRequest(1L, 10L, HelpRequestStatus.COMPLETED);
        when(helpRequestRepository.findById(1L)).thenReturn(Optional.of(request));
        when(reviewRepository.findByRequestId(1L)).thenReturn(Optional.of(buildReview(1L, 1L, 10L, 20L, 4)));

        assertThatThrownBy(() -> reviewService.createReview(10L, 1L,
                new CreateReviewRequest(5, null)))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    private HelpRequest buildRequest(Long id, Long travelerId, HelpRequestStatus status) {
        HelpRequest r = new HelpRequest();
        r.setId(id);
        r.setTravelerId(travelerId);
        r.setRequestType(RequestType.GUIDE);
        r.setLat(37.5);
        r.setLng(127.0);
        r.setStartAt(LocalDateTime.now().plusHours(1));
        r.setDurationMin(60);
        r.setBudgetKrw(10000L);
        r.setStatus(status);
        return r;
    }

    private Review buildReview(Long id, Long requestId, Long reviewerId, Long revieweeId, int rating) {
        Review r = new Review();
        r.setRequestId(requestId);
        r.setReviewerId(reviewerId);
        r.setRevieweeId(revieweeId);
        r.setRating(rating);
        return r;
    }
}
