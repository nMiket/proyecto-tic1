package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.AdminLoginRequest;
import com.upbfood.Backend.entity.AdminUser;
import com.upbfood.Backend.entity.RefreshToken;
import com.upbfood.Backend.repository.AdminUserRepository;
import com.upbfood.Backend.repository.RefreshTokenRepository;
import com.upbfood.Backend.security.JwtService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@Transactional
public class AdminAuthController {

    private static final String REFRESH_COOKIE = "upbfood_refresh_token";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final AdminUserRepository adminUserRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final Duration refreshTokenLifetime;
    private final boolean secureCookie;

    public AdminAuthController(
        AdminUserRepository adminUserRepository,
        RefreshTokenRepository refreshTokenRepository,
        PasswordEncoder passwordEncoder,
        JwtService jwtService,
        @Value("${app.jwt.refresh-token-days:7}") long refreshTokenDays,
        @Value("${app.auth.cookie-secure:false}") boolean secureCookie
    ) {
        this.adminUserRepository = adminUserRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenLifetime = Duration.ofDays(refreshTokenDays);
        this.secureCookie = secureCookie;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody AdminLoginRequest request) {
        if (request == null || request.getEmail() == null || request.getPassword() == null) {
            return badRequest("Email y contraseña son obligatorios.");
        }

        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        AdminUser admin = adminUserRepository.findByEmail(email).orElse(null);

        if (admin == null || !passwordEncoder.matches(request.getPassword(), admin.getPasswordHash())) {
            return unauthorized("Credenciales inválidas.");
        }

        return issueSession(admin, "Login exitoso.");
    }

    @PostMapping("/refresh")
    public ResponseEntity<Map<String, Object>> refresh(
        @CookieValue(value = REFRESH_COOKIE, required = false) String rawRefreshToken
    ) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return unauthorized("La sesión expiró.");
        }

        RefreshToken storedToken = refreshTokenRepository
            .findByTokenHashAndRevokedAtIsNull(hashToken(rawRefreshToken))
            .orElse(null);
        if (storedToken == null || storedToken.getExpiresAt().isBefore(Instant.now())) {
            return unauthorized("La sesión expiró.");
        }

        AdminUser admin = adminUserRepository.findById(storedToken.getAdminUserId()).orElse(null);
        if (admin == null) {
            return unauthorized("Usuario no encontrado.");
        }

        storedToken.setRevokedAt(Instant.now());
        refreshTokenRepository.save(storedToken);
        return issueSession(admin, "Sesión renovada.");
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(
        @CookieValue(value = REFRESH_COOKIE, required = false) String rawRefreshToken
    ) {
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            refreshTokenRepository.findByTokenHashAndRevokedAtIsNull(hashToken(rawRefreshToken))
                .ifPresent(token -> {
                    token.setRevokedAt(Instant.now());
                    refreshTokenRepository.save(token);
                });
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Sesión cerrada.");
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, expiredRefreshCookie().toString())
            .body(response);
    }

    private ResponseEntity<Map<String, Object>> issueSession(AdminUser admin, String message) {
        String rawRefreshToken = generateRefreshToken();
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setAdminUserId(admin.getId());
        refreshToken.setTokenHash(hashToken(rawRefreshToken));
        refreshToken.setCreatedAt(Instant.now());
        refreshToken.setExpiresAt(Instant.now().plus(refreshTokenLifetime));
        refreshTokenRepository.save(refreshToken);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("accessToken", jwtService.generateAccessToken(admin));
        response.put("expiresIn", jwtService.getAccessTokenLifetimeSeconds());
        response.put("id", admin.getId());
        response.put("email", admin.getEmail());
        response.put("restauranteId", admin.getRestauranteId());
        response.put("message", message);

        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookie(rawRefreshToken).toString())
            .body(response);
    }

    private ResponseEntity<Map<String, Object>> badRequest(String message) {
        return ResponseEntity.badRequest().body(errorResponse(message));
    }

    private ResponseEntity<Map<String, Object>> unauthorized(String message) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse(message));
    }

    private Map<String, Object> errorResponse(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("message", message);
        return response;
    }

    private ResponseCookie refreshCookie(String value) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
            .httpOnly(true)
            .secure(secureCookie)
            .sameSite("Lax")
            .path("/api/admin")
            .maxAge(refreshTokenLifetime)
            .build();
    }

    private ResponseCookie expiredRefreshCookie() {
        return ResponseCookie.from(REFRESH_COOKIE, "")
            .httpOnly(true)
            .secure(secureCookie)
            .sameSite("Lax")
            .path("/api/admin")
            .maxAge(Duration.ZERO)
            .build();
    }

    private String generateRefreshToken() {
        byte[] bytes = new byte[48];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 no está disponible.", exception);
        }
    }
}
