package com.localnow.request.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "help_requests")
public class HelpRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "traveler_id", nullable = false)
    private Long travelerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false)
    private RequestType requestType;

    @Column(nullable = false)
    private Double lat;

    @Column(nullable = false)
    private Double lng;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;

    @Column(name = "duration_min", nullable = false)
    private Integer durationMin;

    @Column(name = "budget_krw", nullable = false)
    private Long budgetKrw;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private HelpRequestStatus status = HelpRequestStatus.OPEN;

    @Version
    @Column(nullable = false)
    private Integer version = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public HelpRequest() {}

    public void toMatched() {
        if (status != HelpRequestStatus.OPEN) {
            throw new IllegalStateException("Cannot transition to MATCHED from " + status);
        }
        this.status = HelpRequestStatus.MATCHED;
    }

    public void toInProgress() {
        if (status != HelpRequestStatus.MATCHED) {
            throw new IllegalStateException("Cannot transition to IN_PROGRESS from " + status);
        }
        this.status = HelpRequestStatus.IN_PROGRESS;
    }

    public void toCompleted() {
        if (status != HelpRequestStatus.IN_PROGRESS && status != HelpRequestStatus.MATCHED) {
            throw new IllegalStateException("Cannot transition to COMPLETED from " + status);
        }
        this.status = HelpRequestStatus.COMPLETED;
    }

    public void toCancelled() {
        if (status == HelpRequestStatus.COMPLETED || status == HelpRequestStatus.CANCELLED) {
            throw new IllegalStateException("Cannot transition to CANCELLED from " + status);
        }
        this.status = HelpRequestStatus.CANCELLED;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTravelerId() { return travelerId; }
    public void setTravelerId(Long travelerId) { this.travelerId = travelerId; }

    public RequestType getRequestType() { return requestType; }
    public void setRequestType(RequestType requestType) { this.requestType = requestType; }

    public Double getLat() { return lat; }
    public void setLat(Double lat) { this.lat = lat; }

    public Double getLng() { return lng; }
    public void setLng(Double lng) { this.lng = lng; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getStartAt() { return startAt; }
    public void setStartAt(LocalDateTime startAt) { this.startAt = startAt; }

    public Integer getDurationMin() { return durationMin; }
    public void setDurationMin(Integer durationMin) { this.durationMin = durationMin; }

    public Long getBudgetKrw() { return budgetKrw; }
    public void setBudgetKrw(Long budgetKrw) { this.budgetKrw = budgetKrw; }

    public HelpRequestStatus getStatus() { return status; }
    public void setStatus(HelpRequestStatus status) { this.status = status; }

    public Integer getVersion() { return version; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
