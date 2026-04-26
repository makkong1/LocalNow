package com.localnow.admin.controller;

import static org.mockito.Mockito.when;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import com.localnow.admin.dto.AdminSummaryResponse;
import com.localnow.admin.service.AdminService;
import com.localnow.config.security.JwtProvider;
import com.localnow.config.security.TestSecurityConfig;

@WebMvcTest(AdminController.class)
@Import(TestSecurityConfig.class)
class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminService adminService;

    @MockBean
    @SuppressWarnings("unused")
    private JwtProvider jwtProvider;

    @Test
    void summary_forbiddenForTraveler() throws Exception {
        mockMvc.perform(get("/admin/summary")
                .with(authentication(token(1L, "TRAVELER"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void summary_okForAdmin() throws Exception {
        when(adminService.getSummary()).thenReturn(new AdminSummaryResponse(3, 1, 0, 0, 0, 0));

        mockMvc.perform(get("/admin/summary")
                .contentType(MediaType.APPLICATION_JSON)
                .with(authentication(token(99L, "ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.userCount").value(3));
    }

    @Test
    void summary_unauthenticated_forbidden() throws Exception {
        mockMvc.perform(get("/admin/summary")).andExpect(status().isForbidden());
    }

    private static UsernamePasswordAuthenticationToken token(long userId, String role) {
        return new UsernamePasswordAuthenticationToken(
                userId, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }
}
