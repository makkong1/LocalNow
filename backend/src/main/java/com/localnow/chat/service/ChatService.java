package com.localnow.chat.service;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
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
import com.localnow.chat.repository.ChatMessageRepository;
import com.localnow.chat.repository.ChatRoomRepository;
import com.localnow.common.ErrorCode;
import com.localnow.infra.rabbit.RabbitPublisher;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final RabbitPublisher rabbitPublisher;

    // public ChatService(
    // ChatRoomRepository chatRoomRepository,
    // ChatMessageRepository chatMessageRepository,
    // SimpMessagingTemplate messagingTemplate,
    // RabbitPublisher rabbitPublisher) {
    // this.chatRoomRepository = chatRoomRepository;
    // this.chatMessageRepository = chatMessageRepository;
    // this.messagingTemplate = messagingTemplate;
    // this.rabbitPublisher = rabbitPublisher;
    // }

    @Transactional
    public ChatRoomResponse createRoom(Long requestId, Long travelerId, Long guideId) {
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
    public ChatMessageResponse sendMessage(Long roomId, Long senderId, ChatMessageRequest req) {
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
                    publishAfterCommit("chat.message.sent",
                            Map.of("roomId", roomId, "senderId", senderId,
                                    "receiverId", receiverId, "content", req.content()));

                    return response;
                });
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getHistory(Long roomId, Long requesterId) {
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
    public ChatRoomResponse getRoom(Long requestId, Long requesterId) {
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
