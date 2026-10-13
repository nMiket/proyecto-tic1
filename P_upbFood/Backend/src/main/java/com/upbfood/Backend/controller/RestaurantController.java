
package com.upbfood.Backend.controller;

import com.upbfood.Backend.entity.AdminUser;
import com.upbfood.Backend.entity.AdministradorRestaurante;
import com.upbfood.Backend.entity.Restaurant;
import com.upbfood.Backend.repository.AdministradorRestauranteRepository;
import com.upbfood.Backend.repository.RestaurantRepository;
import com.upbfood.Backend.security.AdminAuthorizationService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class RestaurantController {

    private final RestaurantRepository restaurantRepository;
    private final AdministradorRestauranteRepository administradorRestauranteRepository;
    private final AdminAuthorizationService authorizationService;

    public RestaurantController(
            RestaurantRepository restaurantRepository,
            AdministradorRestauranteRepository administradorRestauranteRepository,
            AdminAuthorizationService authorizationService) {
        this.restaurantRepository = restaurantRepository;
        this.administradorRestauranteRepository = administradorRestauranteRepository;
        this.authorizationService = authorizationService;
    }

    // Catálogo público: todos los restaurantes.
    @GetMapping("/restaurantes")
    public ResponseEntity<List<Restaurant>> listRestaurants() {
        return ResponseEntity.ok(restaurantRepository.findAll());
    }

    // Panel administrativo: solo restaurantes asignados y activos.
    @GetMapping("/admin/restaurantes")
    public ResponseEntity<List<Restaurant>> listAssignedRestaurants() {
        AdminUser admin = authorizationService.getAuthenticatedAdmin();

        List<Integer> restauranteIds =
                administradorRestauranteRepository
                        .findByIdAdministradorId(admin.getId())
                        .stream()
                        .filter(asignacion ->
                                "Activo".equalsIgnoreCase(asignacion.getEstado()))
                        .map(asignacion ->
                                asignacion.getId().getRestauranteId())
                        .toList();

        List<Restaurant> restaurantes =
                restaurantRepository.findAllById(restauranteIds);

        return ResponseEntity.ok(restaurantes);
    }
}
