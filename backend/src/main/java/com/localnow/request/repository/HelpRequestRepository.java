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
import com.localnow.request.domain.RequestType;

import jakarta.persistence.LockModeType;

public interface HelpRequestRepository extends JpaRepository<HelpRequest, Long> {

    long countByStatus(HelpRequestStatus status);

    @Query("SELECT r.status, COUNT(r) FROM HelpRequest r GROUP BY r.status")
    List<Object[]> countGroupByStatus();

    List<HelpRequest> findByTravelerIdOrderByCreatedAtDesc(Long travelerId);

    Page<HelpRequest> findByStatusOrderByCreatedAtDesc(HelpRequestStatus status, Pageable pageable);

    List<HelpRequest> findByTravelerIdOrderByIdDesc(Long travelerId, Pageable pageable);

    List<HelpRequest> findByTravelerIdAndIdLessThanOrderByIdDesc(Long travelerId, Long cursor, Pageable pageable);

    List<HelpRequest> findByStatusOrderByIdDesc(HelpRequestStatus status, Pageable pageable);

    List<HelpRequest> findByStatusAndIdLessThanOrderByIdDesc(HelpRequestStatus status, Long cursor, Pageable pageable);

    List<HelpRequest> findByStatusOrderByBudgetKrwAsc(HelpRequestStatus status, Pageable pageable);

    List<HelpRequest> findByStatusOrderByBudgetKrwDesc(HelpRequestStatus status, Pageable pageable);

    List<HelpRequest> findByStatusAndRequestTypeOrderByBudgetKrwAsc(HelpRequestStatus status, RequestType requestType, Pageable pageable);

    List<HelpRequest> findByStatusAndRequestTypeOrderByBudgetKrwDesc(HelpRequestStatus status, RequestType requestType, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM HelpRequest r WHERE r.id = :id")
    @Transactional
    Optional<HelpRequest> findByIdWithLock(@Param("id") Long id);

    /**
     * SPATIAL INDEX(MBR pre-filter) + ST_Distance_Sphere(exact filter) 조합으로
     * 반경 내 OPEN 요청을 O(log N)으로 조회한다.
     *
     * @param lat      중심 위도
     * @param lng      중심 경도
     * @param latMin   MBR 남쪽 위도
     * @param lngMin   MBR 서쪽 경도
     * @param latMax   MBR 북쪽 위도
     * @param lngMax   MBR 동쪽 경도
     * @param radiusM  정밀 필터 반경 (미터)
     */
    @Query(value = """
        SELECT h.id, h.traveler_id, h.request_type, h.lat, h.lng, h.description,
               h.start_at, h.duration_min, h.budget_krw, h.status, h.version,
               h.created_at, h.updated_at
        FROM help_requests h
        WHERE h.status = 'OPEN'
          AND MBRWithin(
                h.location,
                ST_MakeEnvelope(
                  ST_GeomFromText(CONCAT('POINT(', :lngMin, ' ', :latMin, ')'), 4326),
                  ST_GeomFromText(CONCAT('POINT(', :lngMax, ' ', :latMax, ')'), 4326)
                )
              )
          AND ST_Distance_Sphere(
                h.location,
                ST_GeomFromText(CONCAT('POINT(', :lng, ' ', :lat, ')'), 4326)
              ) <= :radiusM
        ORDER BY h.id DESC
        """, nativeQuery = true)
    List<HelpRequest> findNearbyOpen(
        @Param("lat") double lat,
        @Param("lng") double lng,
        @Param("latMin") double latMin,
        @Param("lngMin") double lngMin,
        @Param("latMax") double latMax,
        @Param("lngMax") double lngMax,
        @Param("radiusM") double radiusM);
}
