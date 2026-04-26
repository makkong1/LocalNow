package com.localnow.common.security;

import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;

import com.localnow.user.domain.UserRole;

/**
 * Maps Spring Security {@link Authentication} authorities to {@link UserRole}.
 */
public final class AuthenticationUserRoles {

    private static final String ROLE_TRAVELER = "ROLE_TRAVELER";
    private static final String ROLE_GUIDE = "ROLE_GUIDE";

    private AuthenticationUserRoles() {
    }

    public static boolean isGuide(@NonNull Authentication authentication) {
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals(ROLE_GUIDE));
    }

    public static boolean isTraveler(@NonNull Authentication authentication) {
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals(ROLE_TRAVELER));
    }

    private static final String ROLE_ADMIN = "ROLE_ADMIN";

    public static boolean isAdmin(@NonNull Authentication authentication) {
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals(ROLE_ADMIN));
    }

    public static UserRole resolveUserRole(@NonNull Authentication authentication) {
        if (isAdmin(authentication)) {
            return UserRole.ADMIN;
        }
        if (isTraveler(authentication)) {
            return UserRole.TRAVELER;
        }
        if (isGuide(authentication)) {
            return UserRole.GUIDE;
        }
        throw new IllegalStateException("Unsupported role in JWT");
    }
}
