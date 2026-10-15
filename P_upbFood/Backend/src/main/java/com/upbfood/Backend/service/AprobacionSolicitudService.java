
package com.upbfood.Backend.service;

import com.upbfood.Backend.entity.AdministradorRestaurante;
import com.upbfood.Backend.entity.AdministradorRestauranteId;
import com.upbfood.Backend.entity.InvitacionAdministrador;
import com.upbfood.Backend.entity.Restaurant;
import com.upbfood.Backend.entity.SolicitudRegistroRestaurante;
import com.upbfood.Backend.repository.AdministradorRestauranteRepository;
import com.upbfood.Backend.repository.RestaurantRepository;
import com.upbfood.Backend.repository.SolicitudRegistroRestauranteRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@Service
public class AprobacionSolicitudService {

    private final SolicitudRegistroRestauranteRepository solicitudRepository;
    private final RestaurantRepository restaurantRepository;
    private final AdministradorRestauranteRepository asignacionRepository;
    private final InvitacionAdministradorService invitacionService;

    public AprobacionSolicitudService(
            SolicitudRegistroRestauranteRepository solicitudRepository,
            RestaurantRepository restaurantRepository,
            AdministradorRestauranteRepository asignacionRepository,
            InvitacionAdministradorService invitacionService
    ) {
        this.solicitudRepository = solicitudRepository;
        this.restaurantRepository = restaurantRepository;
        this.asignacionRepository = asignacionRepository;
        this.invitacionService = invitacionService;
    }

    @Transactional
    public ResultadoAprobacion aprobar(Long solicitudId) {
        SolicitudRegistroRestaurante solicitud =
                solicitudRepository.buscarPorIdParaRevision(solicitudId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "No se encontró la solicitud."
                        ));

        if (!"PENDIENTE".equals(solicitud.getEstado())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Esta solicitud ya fue revisada."
            );
        }

        Restaurant restaurante = new Restaurant();
        restaurante.setNombre(solicitud.getNombreRestaurante());
        restaurante.setUbicacion(solicitud.getUbicacionRestaurante());
        restaurante.setTiempoEstimadoMin(
                solicitud.getTiempoPreparacionMin()
        );
        restaurante.setEstado("Abierto");

        Restaurant restauranteGuardado =
                restaurantRepository.saveAndFlush(restaurante);

        InvitacionAdministradorService.InvitacionCreada creada =
                invitacionService.crearInvitacion(
                        solicitud.getId(),
                        restauranteGuardado.getId(),
                        solicitud.getCorreoSolicitante()
                );

        solicitud.setEstado("APROBADA");
        solicitud.setFechaRevision(LocalDateTime.now());
        solicitud.setObservacionRevision(null);
        solicitudRepository.save(solicitud);

        return new ResultadoAprobacion(
                solicitud.getId(),
                restauranteGuardado.getId(),
                solicitud.getCorreoSolicitante(),
                creada.enlace(),
                creada.invitacion()
        );
    }

    public record ResultadoAprobacion(
            Long solicitudId,
            Integer restauranteId,
            String correoDestino,
            String enlace,
            InvitacionAdministrador invitacion
    ) {}
}
