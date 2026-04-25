package com.localnow.chat.controller;

import com.localnow.chat.dto.ChatMessageRequest;
import com.localnow.chat.service.ChatService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
public class StompChatController {

    private final ChatService chatService;

    public StompChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @MessageMapping("/rooms/{roomId}/messages")
    public void handleMessage(
            @DestinationVariable Long roomId,
            @Payload ChatMessageRequest request,
            Principal principal) {
        Long senderId = Long.parseLong(principal.getName());
        chatService.sendMessage(roomId, senderId, request);
    }
}
