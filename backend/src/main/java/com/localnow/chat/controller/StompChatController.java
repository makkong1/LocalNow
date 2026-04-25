package com.localnow.chat.controller;

import java.security.Principal;

import org.springframework.lang.NonNull;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import com.localnow.chat.dto.ChatMessageRequest;
import com.localnow.chat.service.ChatService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Controller
@RequiredArgsConstructor
@Slf4j
public class StompChatController {

    private final ChatService chatService;

    @MessageMapping("/rooms/{roomId}/messages")
    public void handleMessage(
            @DestinationVariable @NonNull Long roomId,
            @Payload @NonNull ChatMessageRequest request,
            Principal principal) {
        Long senderId = Long.valueOf(principal.getName());
        chatService.sendMessage(roomId, senderId, request);
    }
}
