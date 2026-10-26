package com.upbfood.Backend;

import com.upbfood.Backend.entity.AdminUser;
import com.upbfood.Backend.entity.AdministradorRestaurante;
import com.upbfood.Backend.entity.AdministradorRestauranteId;
import com.upbfood.Backend.repository.AdminUserRepository;
import com.upbfood.Backend.repository.AdministradorRestauranteRepository;
import com.upbfood.Backend.security.AdminAuthorizationService;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminAuthorizationServiceTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void allowsAdminToManageOwnRestaurant() {
        AdminUserRepository userRepository = mock(AdminUserRepository.class);
        AdministradorRestauranteRepository restaurantRepository =
                mock(AdministradorRestauranteRepository.class);

        AdminUser admin = admin("admin@upb.edu.co");

        when(userRepository.findByEmail(admin.getEmail()))
                .thenReturn(Optional.of(admin));

        AdministradorRestaurante assignment = assignment(1, admin.getId());

        when(restaurantRepository.existsById(
                new AdministradorRestauranteId(admin.getId(), 1)))
                .thenReturn(true);

        authenticate(admin.getEmail());

        AdminAuthorizationService service = new AdminAuthorizationService(
                userRepository, restaurantRepository);

        assertDoesNotThrow(() -> service.requireAdminForRestaurant(1));
    }

    @Test
    void deniesAdminAccessToAnotherRestaurant() {
        AdminUserRepository userRepository = mock(AdminUserRepository.class);
        AdministradorRestauranteRepository restaurantRepository =
                mock(AdministradorRestauranteRepository.class);

        AdminUser admin = admin("admin@upb.edu.co");

        when(userRepository.findByEmail(admin.getEmail()))
                .thenReturn(Optional.of(admin));

        when(restaurantRepository.existsById(
                new AdministradorRestauranteId(admin.getId(), 2)))
                .thenReturn(false);

        authenticate(admin.getEmail());

        AdminAuthorizationService service = new AdminAuthorizationService(
                userRepository, restaurantRepository);

        assertThrows(
                AccessDeniedException.class,
                () -> service.requireAdminForRestaurant(2)
        );
    }

    @Test
    void ownerOrKitchenAllowsKitchenButNotOwnerOnlyOperations() {
        AdministradorRestauranteRepository repo = mock(AdministradorRestauranteRepository.class);
        AdminUserRepository users = mock(AdminUserRepository.class);
        AdminUser admin = admin("cocina@upb.edu.co");
        when(users.findByEmail(admin.getEmail())).thenReturn(Optional.of(admin));
        AdministradorRestaurante a = assignment(1, admin.getId());
        a.setTipoAdministradorId(2);
        a.setEstado("Activo");
        when(repo.findById(new AdministradorRestauranteId(admin.getId(), 1))).thenReturn(Optional.of(a));
        authenticate(admin.getEmail());
        AdminAuthorizationService service = new AdminAuthorizationService(users, repo);

        assertDoesNotThrow(() -> service.requireOwnerOrKitchenForRestaurant(1));
        assertThrows(AccessDeniedException.class, () -> service.requireOwnerForRestaurant(1));
    }

    @Test
    void ownerOrKitchenDeniesInactiveOrUnassigned() {
        AdministradorRestauranteRepository repo = mock(AdministradorRestauranteRepository.class);
        AdminUserRepository users = mock(AdminUserRepository.class);
        AdminUser admin = admin("cocina@upb.edu.co");
        when(users.findByEmail(admin.getEmail())).thenReturn(Optional.of(admin));
        AdministradorRestaurante inactiva = assignment(1, admin.getId());
        inactiva.setTipoAdministradorId(2);
        inactiva.setEstado("Inactivo");
        when(repo.findById(new AdministradorRestauranteId(admin.getId(), 1))).thenReturn(Optional.of(inactiva));
        when(repo.findById(new AdministradorRestauranteId(admin.getId(), 2))).thenReturn(Optional.empty());
        authenticate(admin.getEmail());
        AdminAuthorizationService service = new AdminAuthorizationService(users, repo);

        assertThrows(AccessDeniedException.class, () -> service.requireOwnerOrKitchenForRestaurant(1));
        assertThrows(AccessDeniedException.class, () -> service.requireOwnerOrKitchenForRestaurant(2));
    }

    private void authenticate(String email) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        email, null, java.util.List.of())
        );
    }

    private AdminUser admin(String email) {
        AdminUser admin = new AdminUser();
        admin.setId(1);
        admin.setEmail(email);
        return admin;
    }

    private AdministradorRestaurante assignment(
            Integer restauranteId, Integer administradorId) {
        AdministradorRestaurante assignment = new AdministradorRestaurante();
        assignment.setId(new AdministradorRestauranteId(
                administradorId, restauranteId));
        return assignment;
    }
}