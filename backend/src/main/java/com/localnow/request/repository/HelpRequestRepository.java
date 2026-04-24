package com.localnow.request.repository;

import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HelpRequestRepository extends JpaRepository<HelpRequest, Long> {
    List<HelpRequest> findByTravelerIdOrderByCreatedAtDesc(Long travelerId);
    Page<HelpRequest> findByStatusOrderByCreatedAtDesc(HelpRequestStatus status, Pageable pageable);
    List<HelpRequest> findByTravelerIdOrderByIdDesc(Long travelerId, Pageable pageable);
    List<HelpRequest> findByTravelerIdAndIdLessThanOrderByIdDesc(Long travelerId, Long cursor, Pageable pageable);
}
