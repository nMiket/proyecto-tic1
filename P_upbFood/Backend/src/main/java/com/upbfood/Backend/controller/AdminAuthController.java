package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.AdminLoginRequest;
import com.upbfood.Backend.entity.AdminUser;
import com.upbfood.Backend.repository.AdminUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/admin")
public class AdminAuthController {

    private final AdminUserRepository adminUserRepository;

    public AdminAuthController(AdminUserRepository adminUserRepository) {
        this.adminUserRepository = adminUserRepository;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody AdminLoginRequest request) {
        Map<String, Object> response = new HashMap<>();

        if (request == null || request.getEmail() == null || request.getPassword() == null) {
            response.put("success", false);
            response.put("message", "Email y contraseña son obligatorios.");
            return ResponseEntity.badRequest().body(response);
        }

        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        AdminUser admin = adminUserRepository.findByEmail(email).orElse(null);

        if (admin == null || !Objects.equals(request.getPassword(), admin.getPasswordHash())) {
            response.put("success", false);
            response.put("message", "Credenciales inválidas.");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
        }

        response.put("success", true);
        response.put("id", admin.getId());
        response.put("email", admin.getEmail());
        response.put("restauranteId", admin.getRestauranteId());
        response.put("message", "Login exitoso.");
        return ResponseEntity.ok(response);
    }
}
