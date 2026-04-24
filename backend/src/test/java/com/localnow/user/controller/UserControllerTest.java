package com.localnow.user.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.localnow.config.JwtProvider;
import com.localnow.config.SecurityConfig;
import com.localnow.user.dto.AuthResponse;
import com.localnow.user.dto.SignupRequest;
import com.localnow.user.domain.UserRole;
import com.localnow.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
@Import(SecurityConfig.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @MockBean
    private JwtProvider jwtProvider;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void signup_success_returns_201() throws Exception {
        Map<String, Object> request = Map.of(
                "email", "test@test.com",
                "password", "password123",
                "name", "Test User",
                "role", "TRAVELER",
                "languages", List.of("ko"),
                "city", "Seoul"
        );

        when(userService.register(any(SignupRequest.class)))
                .thenReturn(new AuthResponse("mock-token", 1L, "TRAVELER", "Test User"));

        mockMvc.perform(post("/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").value("mock-token"));
    }

    @Test
    void login_success_returns_accessToken() throws Exception {
        Map<String, String> request = Map.of(
                "email", "test@test.com",
                "password", "password123"
        );

        when(userService.login(any()))
                .thenReturn(new AuthResponse("mock-token", 1L, "TRAVELER", "Test User"));

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").value("mock-token"));
    }

    @Test
    void signup_missingEmail_returns_422() throws Exception {
        Map<String, Object> request = Map.of(
                "password", "password123",
                "name", "Test User",
                "role", "TRAVELER"
        );

        mockMvc.perform(post("/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }
}
