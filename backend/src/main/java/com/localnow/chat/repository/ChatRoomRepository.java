package com.localnow.chat.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.localnow.chat.domain.ChatRoom;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {
    Optional<ChatRoom> findByRequestId(Long requestId);

    List<ChatRoom> findByTravelerIdOrGuideIdOrderByIdDesc(Long travelerId, Long guideId);
}
