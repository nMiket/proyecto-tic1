
package com.upbfood.Backend.service;

import com.upbfood.Backend.entity.AdminUser;
import com.upbfood.Backend.entity.AdministradorRestaurante;
import com.upbfood.Backend.entity.AdministradorRestauranteId;
import com.upbfood.Backend.entity.InvitacionAdministrador;
import com.upbfood.Backend.entity.Restaurant;
import com.upbfood.Backend.entity.SolicitudRegistroRestaurante;
import com.upbfood.Backend.repository.AdminUserRepository;
import com.upbfood.Backend.repository.AdministradorRestauranteRepository;
import com.upbfood.Backend.repository.InvitacionAdministradorRepository;
import com.upbfood.Backend.repository.SolicitudRegistroRestauranteRepository;
import com.upbfood.Backend.repository.RestaurantRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@Service
public class ActivacionInvitacionService {

    private static final Integer ROL_DUENO = 1;

    private final InvitacionAdministradorRepository invitacionRepository;
    private final SolicitudRegistroRestauranteRepository solicitudRepository;
    private final AdminUserRepository adminRepository;
    private final AdministradorRestauranteRepository asignacionRepository;
    private final InvitacionAdministradorService invitacionService;
    private final PasswordEncoder passwordEncoder;
    private final RestaurantRepository restaurantRepository;

    public ActivacionInvitacionService(
            InvitacionAdministradorRepository invitacionRepository,
            SolicitudRegistroRestauranteRepository solicitudRepository,
            AdminUserRepository adminRepository,
            AdministradorRestauranteRepository asignacionRepository,
            InvitacionAdministradorService invitacionService,
            PasswordEncoder passwordEncoder,
            RestaurantRepository restaurantRepository
    ) {
        this.invitacionRepository = invitacionRepository;
        this.solicitudRepository = solicitudRepository;
        this.adminRepository = adminRepository;
        this.asignacionRepository = asignacionRepository;
        this.invitacionService = invitacionService;
        this.passwordEncoder = passwordEncoder;
        this.restaurantRepository = restaurantRepository;
    }

    @Transactional
    public void activar(String token, String password) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "El enlace de invitación no es válido."
            );
        }

        String tokenHash = invitacionService.calcularHash(token);

        InvitacionAdministrador invitacion =
                invitacionRepository.buscarPorHashParaUso(tokenHash)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.BAD_REQUEST,
                                "La invitación no existe o no es válida."
                        ));

        if (invitacion.getFechaUso() != null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Esta invitación ya fue utilizada."
            );
        }

        if (!invitacion.getFechaExpiracion().isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(
                    HttpStatus.GONE,
                    "La invitación ha expirado. Solicita una nueva."
            );
        }

        SolicitudRegistroRestaurante solicitud =
                solicitudRepository.findById(invitacion.getSolicitudId())
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "No se encontró la solicitud asociada."
                        ));

        if (!"APROBADA".equals(solicitud.getEstado())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "La solicitud no está aprobada."
            );
        }

        String correo = invitacion.getCorreoDestino()
                .trim()
                .toLowerCase();

        if (adminRepository.findByEmail(correo).isPresent()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ya existe una cuenta con este correo. Contacta al soporte."
            );
        }

        AdminUser admin = new AdminUser();
        admin.setNombre(solicitud.getNombreSolicitante());
        admin.setTelefono(solicitud.getTelefonoSolicitante());
        admin.setEmail(correo);
        admin.setPasswordHash(passwordEncoder.encode(password));

        AdminUser guardado = adminRepository.saveAndFlush(admin);

        // La aprobación solo genera la invitación. El restaurante nace aquí,
        // dentro de la misma transacción que valida y activa la contraseña.
        Restaurant restaurante = new Restaurant();
        restaurante.setNombre(solicitud.getNombreRestaurante());
        restaurante.setUbicacion(solicitud.getUbicacionRestaurante());
        restaurante.setTiempoEstimadoMin(solicitud.getTiempoPreparacionMin());
        restaurante.setEstado("Abierto");
        Restaurant restauranteGuardado = restaurantRepository.saveAndFlush(restaurante);

        invitacion.setRestauranteId(restauranteGuardado.getId());
        invitacionRepository.save(invitacion);

        AdministradorRestaurante asignacion =
                new AdministradorRestaurante();

        asignacion.setId(new AdministradorRestauranteId(
                guardado.getId(),
                restauranteGuardado.getId()
        ));
        asignacion.setTipoAdministradorId(ROL_DUENO);
        asignacion.setEstado("Activo");

        asignacionRepository.save(asignacion);

        invitacion.setFechaUso(LocalDateTime.now());
        invitacionRepository.save(invitacion);
    }
}
