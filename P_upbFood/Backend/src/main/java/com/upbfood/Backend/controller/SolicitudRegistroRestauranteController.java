package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.SolicitudRegistroRestauranteRequest;
import com.upbfood.Backend.dto.SolicitudRevisionRequest;
import com.upbfood.Backend.entity.SolicitudRegistroRestaurante;
import com.upbfood.Backend.repository.SolicitudRegistroRestauranteRepository;
import com.upbfood.Backend.security.AdminAuthorizationService;
import com.upbfood.Backend.service.NotificacionSolicitudRegistroService;
import com.upbfood.Backend.service.AprobacionSolicitudService;
import com.upbfood.Backend.service.NotificacionInvitacionService;

import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/solicitudes-registro")
public class SolicitudRegistroRestauranteController {

    private final SolicitudRegistroRestauranteRepository repository;
    private final NotificacionSolicitudRegistroService notificacionService;
    private final AdminAuthorizationService authorizationService;
    private final AprobacionSolicitudService aprobacionService;
    private final NotificacionInvitacionService notificacionInvitacionService;

    public SolicitudRegistroRestauranteController(
            SolicitudRegistroRestauranteRepository repository,
            NotificacionSolicitudRegistroService notificacionService,
            AdminAuthorizationService authorizationService,
            AprobacionSolicitudService aprobacionService,
            NotificacionInvitacionService notificacionInvitacionService) {
        this.repository = repository;
        this.notificacionService = notificacionService;
        this.authorizationService = authorizationService;
        this.aprobacionService = aprobacionService;
        this.notificacionInvitacionService = notificacionInvitacionService;
    }

    // Registro público de solicitudes.
    @PostMapping
    public ResponseEntity<Map<String, Object>> crearSolicitud(
            @Valid @RequestBody SolicitudRegistroRestauranteRequest request) {
        SolicitudRegistroRestaurante solicitud = new SolicitudRegistroRestaurante();

        solicitud.setNombreSolicitante(
                request.getNombreSolicitante().trim());
        solicitud.setTelefonoSolicitante(
                request.getTelefonoSolicitante().trim());
        solicitud.setCorreoSolicitante(
                request.getCorreoSolicitante().trim().toLowerCase());
        solicitud.setNombreRestaurante(
                request.getNombreRestaurante().trim());
        solicitud.setUbicacionRestaurante(
                request.getUbicacionRestaurante().trim());
        solicitud.setTiempoPreparacionMin(
                request.getTiempoPreparacionMin());
        solicitud.setEstado("PENDIENTE");

        SolicitudRegistroRestaurante guardada = repository.save(solicitud);

        notificacionService.enviarNotificacion(guardada);

        return ResponseEntity.status(HttpStatus.CREATED).body(
                Map.of(
                        "mensaje", "Solicitud enviada correctamente.",
                        "solicitudId", guardada.getId(),
                        "estado", guardada.getEstado()));
    }

    // Solo Top Global puede consultar solicitudes pendientes.
    @GetMapping("/pendientes")
    public List<SolicitudRegistroRestaurante> listarPendientes() {
        authorizationService.requireTopGlobal();

        return repository.findByEstadoOrderByFechaSolicitudDesc(
                "PENDIENTE");
    }

    // Solo Top Global puede rechazar solicitudes.
    @PostMapping("/{id}/rechazar")
    @Transactional
    public ResponseEntity<Map<String, Object>> rechazarSolicitud(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) SolicitudRevisionRequest request) {
        authorizationService.requireTopGlobal();

        SolicitudRegistroRestaurante solicitud = repository.buscarPorIdParaRevision(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "No se encontró la solicitud."));

        if (!"PENDIENTE".equals(solicitud.getEstado())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Esta solicitud ya fue revisada.");
        }

        String observacion = request == null
                ? null
                : request.getObservacion();

        solicitud.setEstado("RECHAZADA");
        solicitud.setFechaRevision(LocalDateTime.now());
        solicitud.setObservacionRevision(
                observacion == null || observacion.isBlank()
                        ? null
                        : observacion.trim());

        repository.save(solicitud);

        return ResponseEntity.ok(
                Map.of(
                        "mensaje", "Solicitud rechazada correctamente.",
                        "solicitudId", solicitud.getId(),
                        "estado", solicitud.getEstado()));
    }

    // Solo Top Global puede aprobar solicitudes.
    @PostMapping("/{id}/aprobar")
    public ResponseEntity<Map<String, Object>> aprobarSolicitud(
            @PathVariable Long id) {
        authorizationService.requireTopGlobal();

        AprobacionSolicitudService.ResultadoAprobacion resultado = aprobacionService.aprobar(id);

        try {
            notificacionInvitacionService.enviarInvitacion(
                    resultado.correoDestino(),
                    resultado.enlace());

            return ResponseEntity.ok(
                    Map.of(
                            "mensaje",
                            "Solicitud aprobada y correo de invitación enviado.",
                            "solicitudId", resultado.solicitudId(),
                            "restauranteId", resultado.restauranteId(),
                            "estado", "APROBADA"));
        } catch (IllegalStateException e) {
            return ResponseEntity.ok(
                    Map.of(
                            "mensaje",
                            "La solicitud fue aprobada, pero no se pudo enviar el correo. Revisa la configuración SMTP antes de reenviar la invitación.",
                            "solicitudId", resultado.solicitudId(),
                            "restauranteId", resultado.restauranteId(),
                            "estado", "APROBADA"));
        }
    }

}