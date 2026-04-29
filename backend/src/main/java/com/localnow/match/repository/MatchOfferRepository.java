package com.localnow.match.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.localnow.match.domain.MatchOffer;
import com.localnow.match.domain.MatchOfferStatus;

public interface MatchOfferRepository extends JpaRepository<MatchOffer, Long> {
    List<MatchOffer> findByRequestId(Long requestId);

    Optional<MatchOffer> findByRequestIdAndGuideId(Long requestId, Long guideId);

    boolean existsByRequestIdAndGuideId(Long requestId, Long guideId);

    int countByRequestIdAndStatus(Long requestId, MatchOfferStatus status);

    @Query(value = """
            SELECT COUNT(*) FROM match_offers mo
            INNER JOIN help_requests hr ON hr.id = mo.request_id
            WHERE mo.guide_id = :guideId
              AND mo.status = 'CONFIRMED'
              AND hr.status = 'COMPLETED'
            """, nativeQuery = true)
    long countCompletedByGuideId(@Param("guideId") Long guideId);
}
