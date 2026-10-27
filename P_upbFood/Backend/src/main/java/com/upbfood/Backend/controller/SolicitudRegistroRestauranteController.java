package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.SolicitudRegistroRestauranteRequest;
import com.upbfood.Backend.entity.SolicitudRegistroRestaurante;
import com.upbfood.Backend.repository.AdminUserRepository;
import com.upbfood.Backend.repository.SolicitudRegistroRestauranteRepository;
import com.upbfood.Backend.service.AprobacionSolicitudService;
import com.upbfood.Backend.service.NotificacionInvitacionService;
import com.upbfood.Backend.service.NotificacionSolicitudRegistroService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
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
    private final AprobacionSolicitudService aprobacionService;
    private final NotificacionInvitacionService notificacionInvitacionService;
    private final AdminUserRepository adminUserRepository;

    public SolicitudRegistroRestauranteController(
            SolicitudRegistroRestauranteRepository repository,
            NotificacionSolicitudRegistroService notificacionService,
            AprobacionSolicitudService aprobacionService,
            NotificacionInvitacionService notificacionInvitacionService,
            AdminUserRepository adminUserRepository) {
        this.repository = repository;
        this.notificacionService = notificacionService;
        this.aprobacionService = aprobacionService;
        this.notificacionInvitacionService = notificacionInvitacionService;
        this.adminUserRepository = adminUserRepository;
    }

    public record DecisionCorreoRequest(
            @NotBlank @Size(max = 200) String token,
            @NotBlank @Pattern(regexp = "aprobar|rechazar") String accion,
            @Size(max = 500) String observacion) {
    }

    // Registro público: envía una notificación con enlaces de decisión al correo configurado.
    @PostMapping
    public ResponseEntity<Map<String, Object>> crearSolicitud(
            @Valid @RequestBody SolicitudRegistroRestauranteRequest request) {
        String correo = request.getCorreoSolicitante().trim().toLowerCase();
        if (adminUserRepository.findByEmail(correo).isPresent()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Ya existe un restaurante registrado con este correo.");
        }

        SolicitudRegistroRestaurante solicitud = new SolicitudRegistroRestaurante();

        solicitud.setNombreSolicitante(request.getNombreSolicitante().trim());
        solicitud.setTelefonoSolicitante(request.getTelefonoSolicitante().trim());
        solicitud.setCorreoSolicitante(correo);
        solicitud.setNombreRestaurante(request.getNombreRestaurante().trim());
        solicitud.setUbicacionRestaurante(request.getUbicacionRestaurante().trim());
        solicitud.setTiempoPreparacionMin(request.getTiempoPreparacionMin());
        solicitud.setEstado("PENDIENTE");

        SolicitudRegistroRestaurante guardada = repository.save(solicitud);
        notificacionService.enviarNotificacion(guardada);

        return ResponseEntity.status(HttpStatus.CREATED).body(
                Map.of(
                        "mensaje", "Solicitud enviada correctamente.",
                        "solicitudId", guardada.getId(),
                        "estado", guardada.getEstado()));
    }

    // Valida el enlace al abrirlo, sin ejecutar la decisión.
    @GetMapping("/revisar-correo")
    public ResponseEntity<Map<String, Object>> validarEnlaceCorreo(
            @RequestParam String token,
            @RequestParam String accion) {
        if (token.isBlank() || !accion.matches("aprobar|rechazar")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "El enlace de revisión no es válido.");
        }

        String tokenHash = notificacionService.hashToken(token);
        SolicitudRegistroRestaurante solicitud = repository.buscarPorTokenRevisionParaValidar(tokenHash)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.GONE,
                        "Esta solicitud ya fue resuelta, el enlace ya fue utilizado o no es válido."));

        if (solicitud.getTokenRevisionExpiracion() == null
                || !solicitud.getTokenRevisionExpiracion().isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(
                    HttpStatus.GONE,
                    "El enlace ha vencido. Solicita que se envíe una nueva notificación.");
        }

        if (!"PENDIENTE".equals(solicitud.getEstado())) {
            throw new ResponseStatusException(HttpStatus.GONE, "Esta solicitud ya fue revisada.");
        }

        boolean tokenAprobar = tokenHash.equals(solicitud.getTokenAprobacionHash());
        boolean tokenRechazar = tokenHash.equals(solicitud.getTokenRechazoHash());
        if (("aprobar".equals(accion) && !tokenAprobar)
                || ("rechazar".equals(accion) && !tokenRechazar)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "El enlace no corresponde a la decisión seleccionada.");
        }

        return ResponseEntity.ok(Map.of("mensaje", "Enlace válido."));
    }

    // La decisión se ejecuta solo después de que el destinatario confirme en la página.
    // La transacción de base de datos se confirma antes de invocar el envío SMTP externo (BE-04).
    @PostMapping("/revisar-correo")
    public ResponseEntity<Map<String, Object>> revisarDesdeCorreo(
            @Valid @RequestBody DecisionCorreoRequest request) {
        String tokenHash = notificacionService.hashToken(request.token());

        if ("rechazar".equals(request.accion())) {
            SolicitudRegistroRestaurante solicitud =
                    aprobacionService.rechazarPorToken(tokenHash, request.observacion());
            boolean correoEnviado = notificacionService.enviarNotificacionRechazo(solicitud);

            return ResponseEntity.ok(Map.of(
                    "mensaje", correoEnviado
                            ? "Solicitud rechazada correctamente. Se envió un correo al solicitante."
                            : "Solicitud rechazada correctamente, pero no se pudo enviar el correo al solicitante. Revisa la configuración de correo.",
                    "solicitudId", solicitud.getId(),
                    "estado", solicitud.getEstado()));
        }

        AprobacionSolicitudService.ResultadoAprobacion resultado =
                aprobacionService.aprobarPorToken(tokenHash);

        try {
            notificacionInvitacionService.enviarInvitacion(
                    resultado.correoDestino(),
                    resultado.enlace());

            return ResponseEntity.ok(Map.of(
                    "mensaje", "Solicitud aprobada. Se envió al solicitante el enlace para activar su cuenta de dueño.",
                    "solicitudId", resultado.solicitudId(),
                    "estado", "APROBADA"));
        } catch (IllegalStateException e) {
            return ResponseEntity.ok(Map.of(
                    "mensaje", "La solicitud fue aprobada, pero no se pudo enviar el enlace de activación al dueño. Revisa la configuración de correo.",
                    "solicitudId", resultado.solicitudId(),
                    "estado", "APROBADA"));
        }
    }
}
