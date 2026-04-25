package com.localnow.chat.controller;

import com.localnow.chat.dto.ChatMessageResponse;
import com.localnow.chat.dto.ChatRoomResponse;
import com.localnow.chat.service.ChatService;
import com.localnow.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping("/requests/{requestId}/room")
    public ResponseEntity<ApiResponse<ChatRoomResponse>> getRoom(
            @PathVariable Long requestId,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(chatService.getRoom(requestId, userId)));
    }

    @GetMapping("/rooms/{roomId}/messages")
    public ResponseEntity<ApiResponse<List<ChatMessageResponse>>> getHistory(
            @PathVariable Long roomId,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(chatService.getHistory(roomId, userId)));
    }
}
