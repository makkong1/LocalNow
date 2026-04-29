package com.localnow.user.controller;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.localnow.config.security.JwtProvider;
import com.localnow.config.security.TestSecurityConfig;
import com.localnow.infra.redis.RedisGeoService;
import com.localnow.user.service.CertificationService;

@WebMvcTest(GuideController.class)
@Import(TestSecurityConfig.class)
class GuideControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RedisGeoService redisGeoService;

    @MockBean
    private CertificationService certificationService;

    @MockBean
    private JwtProvider jwtProvider;

    @Test
    void duty_forbidden_for_traveler() throws Exception {
        Map<String, Object> body = Map.of("onDuty", true, "lat", 37.5, "lng", 127.0);

        mockMvc.perform(post("/guide/duty")
                .with(csrf())
                .with(authentication(token(1L, "TRAVELER")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    void duty_ok_for_guide() throws Exception {
        Map<String, Object> body = Map.of("onDuty", true, "lat", 37.5, "lng", 127.0);

        mockMvc.perform(post("/guide/duty")
                .with(csrf())
                .with(authentication(token(10L, "GUIDE")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    private static UsernamePasswordAuthenticationToken token(long userId, String role) {
        return new UsernamePasswordAuthenticationToken(
                userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }
}
