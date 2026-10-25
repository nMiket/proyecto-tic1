package com.upbfood.Backend.security;

import com.upbfood.Backend.entity.AdminUser;
import com.upbfood.Backend.entity.AdministradorRestaurante;
import com.upbfood.Backend.entity.AdministradorRestauranteId;
import com.upbfood.Backend.repository.AdminUserRepository;
import com.upbfood.Backend.repository.AdministradorRestauranteRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class AdminAuthorizationService {

        private static final Integer ROL_DUENO = 1;
        private static final Integer ROL_COCINA = 2;

        private final AdminUserRepository adminUserRepository;
        private final AdministradorRestauranteRepository administradorRestauranteRepository;

        public AdminAuthorizationService(
                        AdminUserRepository adminUserRepository,
                        AdministradorRestauranteRepository administradorRestauranteRepository) {
                this.adminUserRepository = adminUserRepository;
                this.administradorRestauranteRepository = administradorRestauranteRepository;
        }

        public AdminUser requireAdminForRestaurant(Integer restauranteId) {
                AdminUser admin = getAuthenticatedAdmin();
                obtenerAsignacion(admin, restauranteId);
                return admin;
        }

        public AdminUser requireOwnerForRestaurant(Integer restauranteId) {
                AdminUser admin = getAuthenticatedAdmin();

                AdministradorRestaurante asignacion = obtenerAsignacion(admin, restauranteId);

                if (!ROL_DUENO.equals(asignacion.getTipoAdministradorId())) {
                        throw new AccessDeniedException(
                                        "Solo el dueño puede realizar esta operación.");
                }

                return admin;
        }

        public AdminUser requireKitchenAdminForRestaurant(Integer restauranteId) {
                AdminUser admin = getAuthenticatedAdmin();

                AdministradorRestaurante asignacion = obtenerAsignacion(admin, restauranteId);

                if (!ROL_COCINA.equals(asignacion.getTipoAdministradorId())) {
                        throw new AccessDeniedException(
                                        "Esta operación requiere permisos de administrador de cocina.");
                }

                return admin;
        }

        private AdministradorRestaurante obtenerAsignacion(
                        AdminUser admin, Integer restauranteId) {

                AdministradorRestauranteId id = new AdministradorRestauranteId(
                                admin.getId(), restauranteId);

                AdministradorRestaurante asignacion = administradorRestauranteRepository.findById(id)
                                .orElseThrow(() -> new AccessDeniedException(
                                                "No tienes permisos para esta cafetería."));

                if (!"Activo".equals(asignacion.getEstado())) {
                        throw new AccessDeniedException(
                                        "Tu asignación para esta cafetería está inactiva.");
                }

                return asignacion;
        }

        public AdminUser getAuthenticatedAdmin() {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

                if (authentication == null
                                || !authentication.isAuthenticated()
                                || "anonymousUser".equals(authentication.getPrincipal())) {
                        throw new AccessDeniedException("Se requiere autenticación.");
                }

                return adminUserRepository.findByEmail(authentication.getName())
                                .orElseThrow(() -> new AccessDeniedException("Administrador no encontrado."));
        }
}