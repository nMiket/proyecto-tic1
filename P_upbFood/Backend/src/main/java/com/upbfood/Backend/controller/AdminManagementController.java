package com.upbfood.Backend.controller;

import com.upbfood.Backend.entity.AdminUser;
import com.upbfood.Backend.entity.AdministradorRestaurante;
import com.upbfood.Backend.entity.AdministradorRestauranteId;
import com.upbfood.Backend.repository.AdminUserRepository;
import com.upbfood.Backend.repository.AdministradorRestauranteRepository;
import com.upbfood.Backend.security.AdminAuthorizationService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/restaurantes/{restauranteId}/administradores-cocina")
public class AdminManagementController {

    private static final Integer ROL_DUENO = 1;
    private static final Integer ROL_COCINA = 2;

    private final AdminUserRepository adminUserRepository;
    private final AdministradorRestauranteRepository asignacionRepository;
    private final AdminAuthorizationService authorizationService;
    private final PasswordEncoder passwordEncoder;

    public AdminManagementController(
            AdminUserRepository adminUserRepository,
            AdministradorRestauranteRepository asignacionRepository,
            AdminAuthorizationService authorizationService,
            PasswordEncoder passwordEncoder) {

        this.adminUserRepository = adminUserRepository;
        this.asignacionRepository = asignacionRepository;
        this.authorizationService = authorizationService;
        this.passwordEncoder = passwordEncoder;
    }

    public record CrearAdministradorRequest(
            @NotBlank @Size(max = 50) String nombre,
            @NotBlank @Size(max = 20) String telefono,
            @NotBlank @Email @Size(max = 100) String correo,
            @NotBlank @Size(min = 8, max = 72) String password) {
    }

    public record ActualizarAdministradorRequest(
            @NotBlank @Size(max = 50) String nombre,
            @NotBlank @Size(max = 20) String telefono,
            @NotBlank @Email @Size(max = 100) String correo,
            @Size(max = 72) String password) {
    }

    public record AdministradorCocinaResponse(
            Integer administradorId,
            String nombre,
            String telefono,
            String correo,
            String estado) {
    }

    @GetMapping
    public List<AdministradorCocinaResponse> listar(
            @PathVariable Integer restauranteId) {

        authorizationService.requireOwnerForRestaurant(restauranteId);

        return asignacionRepository
                .findByIdRestauranteIdAndTipoAdministradorIdAndEstado(
                        restauranteId, ROL_COCINA, "Activo")
                .stream()
                .map(asignacion -> {
                    Integer administradorId = asignacion.getId().getAdministradorId();

                    AdminUser admin = adminUserRepository.findById(administradorId)
                            .orElseThrow(() -> new ResponseStatusException(
                                    HttpStatus.NOT_FOUND,
                                    "Administrador no encontrado"));

                    return new AdministradorCocinaResponse(
                            admin.getId(),
                            admin.getNombre(),
                            admin.getTelefono(),
                            admin.getEmail(),
                            asignacion.getEstado());
                })
                .toList();
    }

    @PostMapping
    @Transactional
    public AdministradorCocinaResponse crear(
            @PathVariable Integer restauranteId,
            @Valid @RequestBody CrearAdministradorRequest request) {

        authorizationService.requireOwnerForRestaurant(restauranteId);

        String correo = request.correo().trim().toLowerCase();

        if (adminUserRepository.findByEmail(correo).isPresent()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ya existe una cuenta registrada con ese correo.");
        }

        AdminUser admin = new AdminUser();
        admin.setNombre(request.nombre().trim());
        admin.setTelefono(request.telefono().trim());
        admin.setEmail(correo);
        admin.setPasswordHash(passwordEncoder.encode(request.password()));

        AdminUser guardado = adminUserRepository.save(admin);

        AdministradorRestaurante asignacion = new AdministradorRestaurante();
        asignacion.setId(new AdministradorRestauranteId(
                guardado.getId(), restauranteId));
        asignacion.setTipoAdministradorId(ROL_COCINA);
        asignacion.setEstado("Activo");

        asignacionRepository.save(asignacion);

        return new AdministradorCocinaResponse(
                guardado.getId(),
                guardado.getNombre(),
                guardado.getTelefono(),
                guardado.getEmail(),
                asignacion.getEstado());
    }

    @PutMapping("/{administradorId}")
    @Transactional
    public AdministradorCocinaResponse actualizar(
            @PathVariable Integer restauranteId,
            @PathVariable Integer administradorId,
            @Valid @RequestBody ActualizarAdministradorRequest request) {

        authorizationService.requireOwnerForRestaurant(restauranteId);

        AdministradorRestauranteId asignacionId = new AdministradorRestauranteId(
                administradorId, restauranteId);

        AdministradorRestaurante asignacion = asignacionRepository.findById(asignacionId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "El administrador no está asignado a este restaurante."));

        if (!ROL_COCINA.equals(asignacion.getTipoAdministradorId())) {
            throw new AccessDeniedException(
                    "Solo se pueden editar cuentas de personal de cocina.");
        }

        AdminUser admin = adminUserRepository.findById(administradorId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Administrador no encontrado."));

        String nuevoCorreo = request.correo().trim().toLowerCase();
        if (!nuevoCorreo.equalsIgnoreCase(admin.getEmail())) {
            adminUserRepository.findByEmail(nuevoCorreo)
                    .filter(existente -> !existente.getId().equals(administradorId))
                    .ifPresent(existente -> {
                        throw new ResponseStatusException(
                                HttpStatus.CONFLICT,
                                "Ya existe otra cuenta registrada con ese correo.");
                    });
            admin.setEmail(nuevoCorreo);
        }

        admin.setNombre(request.nombre().trim());
        admin.setTelefono(request.telefono().trim());

        if (request.password() != null && !request.password().isBlank()) {
            if (request.password().length() < 8) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "La nueva contraseña debe tener al menos 8 caracteres.");
            }
            admin.setPasswordHash(passwordEncoder.encode(request.password()));
        }

        AdminUser actualizado = adminUserRepository.save(admin);

        return new AdministradorCocinaResponse(
                actualizado.getId(),
                actualizado.getNombre(),
                actualizado.getTelefono(),
                actualizado.getEmail(),
                asignacion.getEstado());
    }

    @DeleteMapping("/{administradorId}")
    @Transactional
    public void retirarAcceso(
            @PathVariable Integer restauranteId,
            @PathVariable Integer administradorId) {

        authorizationService.requireOwnerForRestaurant(restauranteId);

        AdministradorRestauranteId id = new AdministradorRestauranteId(
                administradorId, restauranteId);

        AdministradorRestaurante asignacion = asignacionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "El administrador no está asignado a este restaurante."));

        if (!ROL_COCINA.equals(asignacion.getTipoAdministradorId())) {
            throw new AccessDeniedException(
                    "Solo se puede retirar el acceso a administradores de cocina.");
        }

        if (!"Activo".equals(asignacion.getEstado())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "La asignación ya está inactiva.");
        }

        asignacion.setEstado("Inactivo");
        asignacionRepository.save(asignacion);
    }
}
