package com.localnow.chat.domain;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_rooms")
public class ChatRoom {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, unique = true)
    private Long requestId;

    @Column(name = "traveler_id", nullable = false)
    private Long travelerId;

    @Column(name = "guide_id", nullable = false)
    private Long guideId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public ChatRoom() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getRequestId() { return requestId; }
    public void setRequestId(Long requestId) { this.requestId = requestId; }

    public Long getTravelerId() { return travelerId; }
    public void setTravelerId(Long travelerId) { this.travelerId = travelerId; }

    public Long getGuideId() { return guideId; }
    public void setGuideId(Long guideId) { this.guideId = guideId; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public boolean isParticipant(Long userId) {
        return travelerId.equals(userId) || guideId.equals(userId);
    }
}
