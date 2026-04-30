package com.localnow.chat.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.localnow.chat.dto.ChatMessageResponse;
import com.localnow.chat.dto.ChatRoomResponse;
import com.localnow.chat.dto.ChatRoomSummaryResponse;
import com.localnow.chat.service.ChatService;
import com.localnow.common.ApiResponse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping("/chat")
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatService chatService;

    @GetMapping("/rooms")
    public ResponseEntity<ApiResponse<List<ChatRoomSummaryResponse>>> getRooms(
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(chatService.getRoomsForUser(userId)));
    }

    @GetMapping("/requests/{requestId}/room")
    public ResponseEntity<ApiResponse<ChatRoomResponse>> getRoom(
            @PathVariable @NonNull Long requestId,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(chatService.getRoom(requestId, userId)));
    }

    @GetMapping("/rooms/{roomId}/messages")
    public ResponseEntity<ApiResponse<List<ChatMessageResponse>>> getHistory(
            @PathVariable @NonNull Long roomId,
            Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(ApiResponse.ok(chatService.getHistory(roomId, userId)));
    }
}
