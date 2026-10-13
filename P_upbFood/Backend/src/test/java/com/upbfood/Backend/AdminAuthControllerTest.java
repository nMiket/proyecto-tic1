package com.upbfood.Backend;

import com.upbfood.Backend.controller.AdminAuthController;
import com.upbfood.Backend.dto.AdminLoginRequest;
import com.upbfood.Backend.entity.AdminUser;
import com.upbfood.Backend.entity.AdministradorRestaurante;
import com.upbfood.Backend.entity.AdministradorRestauranteId;
import com.upbfood.Backend.repository.AdminUserRepository;
import com.upbfood.Backend.repository.AdministradorRestauranteRepository;
import com.upbfood.Backend.repository.RefreshTokenRepository;
import com.upbfood.Backend.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AdminAuthControllerTest {

    @Test
    void loginReturnsOkForValidCredentials() {
        AdminUserRepository repository = mock(AdminUserRepository.class);
        AdministradorRestauranteRepository restauranteRepository =
                mock(AdministradorRestauranteRepository.class);
        RefreshTokenRepository refreshTokenRepository =
                mock(RefreshTokenRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        JwtService jwtService = mock(JwtService.class);

        AdminAuthController controller = new AdminAuthController(
                repository,
                restauranteRepository,
                refreshTokenRepository,
                passwordEncoder,
                jwtService,
                7,
                false
        );

        AdminUser admin = new AdminUser();
        admin.setId(1);
        admin.setEmail("admin@upb.edu.co");
        admin.setPasswordHash("$2a$10$bcrypt-hash");

        AdministradorRestaurante asociacion = new AdministradorRestaurante();
        asociacion.setId(new AdministradorRestauranteId(1, 1));

        when(repository.findByEmail("admin@upb.edu.co"))
                .thenReturn(Optional.of(admin));

        when(passwordEncoder.matches(
                "admin123", admin.getPasswordHash()))
                .thenReturn(true);

        when(restauranteRepository.findByIdAdministradorId(1))
                .thenReturn(List.of(asociacion));

        when(jwtService.generateAccessToken(admin))
                .thenReturn("access-token");

        when(jwtService.getAccessTokenLifetimeSeconds())
                .thenReturn(900L);

        AdminLoginRequest request = new AdminLoginRequest();
        request.setEmail("admin@upb.edu.co");
        request.setPassword("admin123");

        ResponseEntity<Map<String, Object>> response =
                controller.login(request);

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(true, response.getBody().get("success"));
        assertEquals("admin@upb.edu.co", response.getBody().get("email"));
        assertEquals("access-token", response.getBody().get("accessToken"));
        assertEquals(1, response.getBody().get("restauranteId"));
        assertEquals(List.of(1), response.getBody().get("restaurantes"));

        verify(passwordEncoder).matches(
                "admin123", admin.getPasswordHash());
        verify(refreshTokenRepository).save(any());
    }

    @Test
    void loginReturnsUnauthorizedForInvalidCredentials() {
        AdminUserRepository repository = mock(AdminUserRepository.class);
        AdministradorRestauranteRepository restauranteRepository =
                mock(AdministradorRestauranteRepository.class);
        RefreshTokenRepository refreshTokenRepository =
                mock(RefreshTokenRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        JwtService jwtService = mock(JwtService.class);

        AdminAuthController controller = new AdminAuthController(
                repository,
                restauranteRepository,
                refreshTokenRepository,
                passwordEncoder,
                jwtService,
                7,
                false
        );

        when(repository.findByEmail("admin@upb.edu.co"))
                .thenReturn(Optional.empty());

        AdminLoginRequest request = new AdminLoginRequest();
        request.setEmail("admin@upb.edu.co");
        request.setPassword("wrong");

        ResponseEntity<Map<String, Object>> response =
                controller.login(request);

        assertEquals(401, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(false, response.getBody().get("success"));

        verifyNoInteractions(restauranteRepository);
        verifyNoInteractions(refreshTokenRepository);
    }
}