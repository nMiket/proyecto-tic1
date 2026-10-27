package com.upbfood.Backend.controller;

import com.upbfood.Backend.entity.AdminUser;
import com.upbfood.Backend.entity.AdministradorRestaurante;
import com.upbfood.Backend.entity.Restaurant;
import com.upbfood.Backend.repository.AdministradorRestauranteRepository;
import com.upbfood.Backend.repository.RestaurantRepository;
import com.upbfood.Backend.security.AdminAuthorizationService;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class RestaurantController {

    private final RestaurantRepository restaurantRepository;
    private final AdministradorRestauranteRepository administradorRestauranteRepository;
    private final AdminAuthorizationService authorizationService;
    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;

    public RestaurantController(
            RestaurantRepository restaurantRepository,
            AdministradorRestauranteRepository administradorRestauranteRepository,
            AdminAuthorizationService authorizationService,
            JdbcTemplate jdbcTemplate,
            PasswordEncoder passwordEncoder) {
        this.restaurantRepository = restaurantRepository;
        this.administradorRestauranteRepository = administradorRestauranteRepository;
        this.authorizationService = authorizationService;
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
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

    // Configuración operativa: estado (Abierto, Cerrado, Alta demanda) y tiempo de espera estimado.
    @Transactional
    @PatchMapping("/admin/restaurantes/{id}")
    public ResponseEntity<Restaurant> updateRestaurantConfig(
            @PathVariable Integer id,
            @RequestBody Map<String, Object> request) {

        authorizationService.requireAdminForRestaurant(id);

        Restaurant restaurant = restaurantRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Restaurante no encontrado."));

        if (request.containsKey("nombre") && request.get("nombre") != null) {
            String nuevoNombre = request.get("nombre").toString().trim();
            if (nuevoNombre.isEmpty()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "El nombre del restaurante no puede estar vacío.");
            }
            if (nuevoNombre.length() > 50) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "El nombre del restaurante no puede superar 50 caracteres.");
            }
            restaurant.setNombre(nuevoNombre);
        }

        if (request.containsKey("ubicacion") && request.get("ubicacion") != null) {
            String nuevaUbicacion = request.get("ubicacion").toString().trim();
            if (nuevaUbicacion.isEmpty()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "La ubicación del restaurante no puede estar vacía.");
            }
            if (nuevaUbicacion.length() > 50) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "La ubicación del restaurante no puede superar 50 caracteres.");
            }
            restaurant.setUbicacion(nuevaUbicacion);
        }

        if (request.containsKey("imagenUrl") || request.containsKey("imagen")) {
            Object imgVal = request.containsKey("imagenUrl") ? request.get("imagenUrl") : request.get("imagen");
            String nuevaImagen = imgVal != null ? imgVal.toString().trim() : null;
            if (nuevaImagen != null && !nuevaImagen.isEmpty()) {
                if (nuevaImagen.length() > 2_000_000) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "La imagen supera el tamaño máximo permitido.");
                }
                String lower = nuevaImagen.toLowerCase();
                if (!lower.startsWith("https://") && !lower.startsWith("http://") && !lower.startsWith("data:image/")) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "La imagen debe ser un enlace HTTP/HTTPS válido o una imagen cargada desde el dispositivo.");
                }
                restaurant.setImagenUrl(nuevaImagen);
            } else {
                restaurant.setImagenUrl(null);
            }
        }

        if (request.containsKey("estado") && request.get("estado") != null) {
            String nuevoEstado = request.get("estado").toString().trim();
            if (!List.of("Abierto", "Cerrado", "Alta demanda").contains(nuevoEstado)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Estado inválido. Debe ser 'Abierto', 'Cerrado' o 'Alta demanda'.");
            }
            restaurant.setEstado(nuevoEstado);
        }

        if (request.containsKey("tiempoEstimadoMin") && request.get("tiempoEstimadoMin") != null) {
            int tiempo = ((Number) request.get("tiempoEstimadoMin")).intValue();
            if (tiempo <= 0 || tiempo > 240) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "El tiempo de espera debe estar entre 1 y 240 minutos.");
            }
            restaurant.setTiempoEstimadoMin(tiempo);
        }

        Restaurant guardado = restaurantRepository.save(restaurant);
        return ResponseEntity.ok(guardado);
    }

    /**
     * El dueño puede eliminar su restaurante únicamente si nunca se han
     * registrado pedidos asociados a él. La validación vive aquí para que no
     * pueda omitirse llamando directamente a la API.
     */
    @Transactional
    @DeleteMapping("/admin/restaurantes/{id}")
    public ResponseEntity<Void> deleteRestaurant(
            @PathVariable Integer id,
            @RequestBody DeleteRestaurantRequest request) {
        AdminUser owner = authorizationService.requireOwnerForRestaurant(id);

        if (request == null || request.password() == null || request.password().isBlank()
                || !passwordEncoder.matches(request.password(), owner.getPasswordHash())) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "La contraseña del dueño no es correcta.");
        }

        if (!restaurantRepository.existsById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Restaurante no encontrado.");
        }

        Integer pedidos = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pedido WHERE restaurante_id = ?",
                Integer.class,
                id);

        if (pedidos != null && pedidos > 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "No se puede eliminar el restaurante porque tiene pedidos registrados.");
        }

        // No hay pedidos, por lo que se pueden quitar de forma segura sus
        // relaciones y configuración antes de borrar el restaurante.
        jdbcTemplate.update("DELETE FROM invitacion_administrador WHERE restaurante_id = ?", id);
        jdbcTemplate.update("DELETE FROM producto_adicion WHERE restaurante_id = ?", id);
        jdbcTemplate.update("DELETE FROM producto_restaurante WHERE restaurante_id = ?", id);
        jdbcTemplate.update("DELETE FROM administrador_restaurante WHERE restaurante_id = ?", id);
        restaurantRepository.deleteById(id);

        return ResponseEntity.noContent().build();
    }

    public record DeleteRestaurantRequest(String password) {
    }
}
