
package com.upbfood.Backend.service;

import com.upbfood.Backend.entity.InvitacionAdministrador;
import com.upbfood.Backend.entity.SolicitudRegistroRestaurante;
import com.upbfood.Backend.repository.SolicitudRegistroRestauranteRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@Service
public class AprobacionSolicitudService {

    private final SolicitudRegistroRestauranteRepository solicitudRepository;
    private final InvitacionAdministradorService invitacionService;

    public AprobacionSolicitudService(
            SolicitudRegistroRestauranteRepository solicitudRepository,
            InvitacionAdministradorService invitacionService
    ) {
        this.solicitudRepository = solicitudRepository;
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

        InvitacionAdministradorService.InvitacionCreada creada =
                invitacionService.crearInvitacion(
                        solicitud.getId(),
                        null,
                        solicitud.getCorreoSolicitante()
                );

        solicitud.setEstado("APROBADA");
        solicitud.setFechaRevision(LocalDateTime.now());
        solicitud.setObservacionRevision(null);
        solicitud.setTokenAprobacionHash(null);
        solicitud.setTokenRechazoHash(null);
        solicitud.setTokenRevisionExpiracion(null);
        solicitudRepository.save(solicitud);

        return new ResultadoAprobacion(
                solicitud.getId(),
                null,
                solicitud.getCorreoSolicitante(),
                creada.enlace(),
                creada.invitacion()
        );
    }

    @Transactional
    public SolicitudRegistroRestaurante rechazarPorToken(String tokenHash, String observacion) {
        SolicitudRegistroRestaurante solicitud =
                validarSolicitudPorToken(tokenHash, "rechazar");
        solicitud.setEstado("RECHAZADA");
        solicitud.setFechaRevision(LocalDateTime.now());
        solicitud.setObservacionRevision(
                observacion == null || observacion.isBlank() ? null : observacion.trim()
        );
        solicitud.setTokenAprobacionHash(null);
        solicitud.setTokenRechazoHash(null);
        solicitud.setTokenRevisionExpiracion(null);
        return solicitudRepository.save(solicitud);
    }

    @Transactional
    public ResultadoAprobacion aprobarPorToken(String tokenHash) {
        SolicitudRegistroRestaurante solicitud =
                validarSolicitudPorToken(tokenHash, "aprobar");
        return aprobar(solicitud.getId());
    }

    private SolicitudRegistroRestaurante validarSolicitudPorToken(String tokenHash, String accion) {
        SolicitudRegistroRestaurante solicitud = solicitudRepository.buscarPorTokenRevision(tokenHash)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.GONE,
                        "Esta solicitud ya fue resuelta, el enlace ya fue utilizado o no es válido."
                ));

        if (solicitud.getTokenRevisionExpiracion() == null
                || !solicitud.getTokenRevisionExpiracion().isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(
                    HttpStatus.GONE,
                    "El enlace ha vencido. Solicita que se envíe una nueva notificación."
            );
        }

        if (!"PENDIENTE".equals(solicitud.getEstado())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Esta solicitud ya fue revisada."
            );
        }

        boolean tokenAprobar = tokenHash.equals(solicitud.getTokenAprobacionHash());
        boolean tokenRechazar = tokenHash.equals(solicitud.getTokenRechazoHash());

        if (("aprobar".equals(accion) && !tokenAprobar)
                || ("rechazar".equals(accion) && !tokenRechazar)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "El enlace no corresponde a la decisión seleccionada."
            );
        }
        return solicitud;
    }

    public record ResultadoAprobacion(
            Long solicitudId,
            Integer restauranteId,
            String correoDestino,
            String enlace,
            InvitacionAdministrador invitacion
    ) {}
}
