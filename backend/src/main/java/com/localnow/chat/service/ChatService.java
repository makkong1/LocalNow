package com.localnow.chat.service;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import com.localnow.chat.domain.ChatMessage;
import com.localnow.chat.domain.ChatRoom;
import com.localnow.chat.dto.ChatMessageRequest;
import com.localnow.chat.dto.ChatMessageResponse;
import com.localnow.chat.dto.ChatRoomResponse;
import com.localnow.chat.dto.ChatRoomSummaryResponse;
import com.localnow.chat.repository.ChatMessageRepository;
import com.localnow.chat.repository.ChatRoomRepository;
import com.localnow.common.ErrorCode;
import com.localnow.infra.rabbit.RabbitPublisher;
import com.localnow.request.repository.HelpRequestRepository;
import com.localnow.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final RabbitPublisher rabbitPublisher;
    private final HelpRequestRepository helpRequestRepository;
    private final UserRepository userRepository;

    @Transactional
    public ChatRoomResponse createRoom(
            @NonNull Long requestId, @NonNull Long travelerId, @NonNull Long guideId) {
        return chatRoomRepository.findByRequestId(requestId)
                .map(this::toRoomResponse)
                .orElseGet(() -> {
                    ChatRoom room = new ChatRoom();
                    room.setRequestId(requestId);
                    room.setTravelerId(travelerId);
                    room.setGuideId(guideId);
                    return toRoomResponse(chatRoomRepository.save(room));
                });
    }

    @Transactional
    public ChatMessageResponse sendMessage(
            @NonNull Long roomId, @NonNull Long senderId, @NonNull ChatMessageRequest req) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

        if (!room.isParticipant(senderId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
        }

        return chatMessageRepository
                .findByRoomIdAndSenderIdAndClientMessageId(roomId, senderId, req.clientMessageId())
                .map(this::toMessageResponse)
                .orElseGet(() -> {
                    ChatMessage msg = new ChatMessage();
                    msg.setRoomId(roomId);
                    msg.setSenderId(senderId);
                    msg.setContent(req.content());
                    msg.setClientMessageId(req.clientMessageId());
                    ChatMessage saved = chatMessageRepository.save(msg);
                    ChatMessageResponse response = toMessageResponse(saved);

                    messagingTemplate.convertAndSend("/topic/rooms/" + roomId, response);

                    Long receiverId = senderId.equals(room.getTravelerId())
                            ? room.getGuideId()
                            : room.getTravelerId();
                    Long receiver = Objects.requireNonNull(receiverId, "receiver for notification");
                    publishAfterCommit("chat.message.sent",
                            Map.of("roomId", roomId, "senderId", senderId,
                                    "receiverId", receiver, "content", req.content()));

                    return response;
                });
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getHistory(@NonNull Long roomId, @NonNull Long requesterId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

        if (!room.isParticipant(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
        }

        return chatMessageRepository.findByRoomIdOrderBySentAtAsc(roomId).stream()
                .map(this::toMessageResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ChatRoomSummaryResponse> getRoomsForUser(@NonNull Long userId) {
        // TODO: N+1 — replace with a single JOIN query when room count grows
        List<ChatRoom> rooms = chatRoomRepository.findByTravelerIdOrGuideIdOrderByIdDesc(userId, userId);
        return rooms.stream().map(room -> {
            String requestType = helpRequestRepository.findById(room.getRequestId())
                    .map(r -> r.getRequestType().name())
                    .orElse("GUIDE");
            Long partnerId = userId.equals(room.getTravelerId()) ? room.getGuideId() : room.getTravelerId();
            String partnerName = userRepository.findById(partnerId)
                    .map(u -> u.getName())
                    .orElse("Unknown");
            return chatMessageRepository.findTopByRoomIdOrderBySentAtDesc(room.getId())
                    .map(msg -> new ChatRoomSummaryResponse(
                            room.getId(), room.getRequestId(), requestType,
                            partnerName, msg.getContent(), msg.getSentAt()))
                    .orElse(new ChatRoomSummaryResponse(
                            room.getId(), room.getRequestId(), requestType,
                            partnerName, null, null));
        }).toList();
    }

    @Transactional(readOnly = true)
    public ChatRoomResponse getRoom(@NonNull Long requestId, @NonNull Long requesterId) {
        ChatRoom room = chatRoomRepository.findByRequestId(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));

        if (!room.isParticipant(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    ErrorCode.AUTH_FORBIDDEN.getDefaultMessage());
        }

        return toRoomResponse(room);
    }

    private void publishAfterCommit(String routingKey, Object payload) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    rabbitPublisher.publish(routingKey, payload);
                }
            });
        } else {
            rabbitPublisher.publish(routingKey, payload);
        }
    }

    private ChatRoomResponse toRoomResponse(ChatRoom room) {
        return new ChatRoomResponse(room.getId(), room.getRequestId(),
                room.getTravelerId(), room.getGuideId(), room.getCreatedAt());
    }

    private ChatMessageResponse toMessageResponse(ChatMessage msg) {
        return new ChatMessageResponse(msg.getId(), msg.getRoomId(), msg.getSenderId(),
                msg.getContent(), msg.getSentAt(), msg.getClientMessageId());
    }
}
