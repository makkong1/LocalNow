package com.localnow.match.repository;

import com.localnow.match.domain.MatchOffer;
import com.localnow.match.domain.MatchOfferStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MatchOfferRepository extends JpaRepository<MatchOffer, Long> {
    List<MatchOffer> findByRequestId(Long requestId);
    Optional<MatchOffer> findByRequestIdAndGuideId(Long requestId, Long guideId);
    boolean existsByRequestIdAndGuideId(Long requestId, Long guideId);
    int countByRequestIdAndStatus(Long requestId, MatchOfferStatus status);
}
