package com.upbfood.Backend;

import com.upbfood.Backend.entity.AdminUser;
import com.upbfood.Backend.repository.AdminUserRepository;
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
        AdminUserRepository repository = mock(AdminUserRepository.class);
        AdminUser admin = admin("admin@upb.edu.co", 1L);
        when(repository.findByEmail(admin.getEmail())).thenReturn(Optional.of(admin));
        authenticate(admin.getEmail());

        AdminAuthorizationService service = new AdminAuthorizationService(repository);

        assertDoesNotThrow(() -> service.requireAdminForRestaurant(1L));
    }

    @Test
    void deniesAdminAccessToAnotherRestaurant() {
        AdminUserRepository repository = mock(AdminUserRepository.class);
        AdminUser admin = admin("admin@upb.edu.co", 1L);
        when(repository.findByEmail(admin.getEmail())).thenReturn(Optional.of(admin));
        authenticate(admin.getEmail());

        AdminAuthorizationService service = new AdminAuthorizationService(repository);

        assertThrows(AccessDeniedException.class, () -> service.requireAdminForRestaurant(2L));
    }

    private void authenticate(String email) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(email, null, java.util.List.of())
        );
    }

    private AdminUser admin(String email, Long restaurantId) {
        AdminUser admin = new AdminUser();
        admin.setEmail(email);
        admin.setRestauranteId(restaurantId);
        return admin;
    }
}
