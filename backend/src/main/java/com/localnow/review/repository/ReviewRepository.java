package com.localnow.review.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.localnow.review.domain.Review;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    Optional<Review> findByRequestId(Long requestId);

    List<Review> findByRevieweeIdOrderByIdDesc(Long revieweeId, Pageable pageable);

    List<Review> findByRevieweeIdAndIdLessThanOrderByIdDesc(Long revieweeId, Long cursor, Pageable pageable);
}
