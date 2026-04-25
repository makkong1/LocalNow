package com.localnow.request.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;

import jakarta.persistence.LockModeType;

public interface HelpRequestRepository extends JpaRepository<HelpRequest, Long> {
    List<HelpRequest> findByTravelerIdOrderByCreatedAtDesc(Long travelerId);

    Page<HelpRequest> findByStatusOrderByCreatedAtDesc(HelpRequestStatus status, Pageable pageable);

    List<HelpRequest> findByTravelerIdOrderByIdDesc(Long travelerId, Pageable pageable);

    List<HelpRequest> findByTravelerIdAndIdLessThanOrderByIdDesc(Long travelerId, Long cursor, Pageable pageable);

    List<HelpRequest> findByStatusOrderByIdDesc(HelpRequestStatus status, Pageable pageable);

    List<HelpRequest> findByStatusAndIdLessThanOrderByIdDesc(HelpRequestStatus status, Long cursor, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM HelpRequest r WHERE r.id = :id")
    @Transactional
    Optional<HelpRequest> findByIdWithLock(@Param("id") Long id);
}
