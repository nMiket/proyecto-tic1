package com.upbfood.Backend.security;

import com.upbfood.Backend.entity.AdminUser;
import com.upbfood.Backend.repository.AdminUserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class AdminAuthorizationService {

    private final AdminUserRepository adminUserRepository;

    public AdminAuthorizationService(AdminUserRepository adminUserRepository) {
        this.adminUserRepository = adminUserRepository;
    }

    public AdminUser requireAdminForRestaurant(Long restauranteId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Se requiere autenticación.");
        }

        AdminUser admin = adminUserRepository.findByEmail(authentication.getName()).orElseThrow(
            () -> new AccessDeniedException("Administrador no encontrado.")
        );

        if (!admin.getRestauranteId().equals(restauranteId)) {
            throw new AccessDeniedException("No tienes permisos para esta cafetería.");
        }

        return admin;
    }
}
