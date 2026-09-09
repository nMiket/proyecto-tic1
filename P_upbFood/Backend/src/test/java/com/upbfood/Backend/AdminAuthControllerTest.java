package com.upbfood.Backend;

import com.upbfood.Backend.controller.AdminAuthController;
import com.upbfood.Backend.dto.AdminLoginRequest;
import com.upbfood.Backend.entity.AdminUser;
import com.upbfood.Backend.repository.RefreshTokenRepository;
import com.upbfood.Backend.repository.AdminUserRepository;
import com.upbfood.Backend.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminAuthControllerTest {

    @Test
    void loginReturnsOkForValidCredentials() {
        AdminUserRepository repository = mock(AdminUserRepository.class);
        RefreshTokenRepository refreshTokenRepository = mock(RefreshTokenRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        JwtService jwtService = mock(JwtService.class);
        AdminAuthController controller = new AdminAuthController(
            repository, refreshTokenRepository, passwordEncoder, jwtService, 7, false);

        AdminUser admin = new AdminUser();
        admin.setId(1L);
        admin.setEmail("admin@upb.edu.co");
        admin.setPasswordHash("$2a$10$bcrypt-hash");
        admin.setRestauranteId(1L);

        when(repository.findByEmail("admin@upb.edu.co")).thenReturn(Optional.of(admin));
        when(passwordEncoder.matches("admin123", admin.getPasswordHash())).thenReturn(true);
        when(jwtService.generateAccessToken(admin)).thenReturn("access-token");
        when(jwtService.getAccessTokenLifetimeSeconds()).thenReturn(900L);

        AdminLoginRequest request = new AdminLoginRequest();
        request.setEmail("admin@upb.edu.co");
        request.setPassword("admin123");

        ResponseEntity<Map<String, Object>> response = controller.login(request);

        assertEquals(200, response.getStatusCode().value());
        assertTrue((Boolean) response.getBody().get("success"));
        assertEquals("admin@upb.edu.co", response.getBody().get("email"));
        assertEquals("access-token", response.getBody().get("accessToken"));
        verify(passwordEncoder).matches("admin123", admin.getPasswordHash());
    }

    @Test
    void loginReturnsUnauthorizedForInvalidCredentials() {
        AdminUserRepository repository = mock(AdminUserRepository.class);
        RefreshTokenRepository refreshTokenRepository = mock(RefreshTokenRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        JwtService jwtService = mock(JwtService.class);
        AdminAuthController controller = new AdminAuthController(
            repository, refreshTokenRepository, passwordEncoder, jwtService, 7, false);

        when(repository.findByEmail("admin@upb.edu.co")).thenReturn(Optional.empty());

        AdminLoginRequest request = new AdminLoginRequest();
        request.setEmail("admin@upb.edu.co");
        request.setPassword("wrong");

        ResponseEntity<Map<String, Object>> response = controller.login(request);

        assertEquals(401, response.getStatusCode().value());
        assertFalse((Boolean) response.getBody().get("success"));
    }
}
