package com.upbfood.Backend.controller;

import com.upbfood.Backend.entity.SolicitudRegistroRestaurante;
import com.upbfood.Backend.repository.SolicitudRegistroRestauranteRepository;
import com.upbfood.Backend.service.AprobacionSolicitudService;
import com.upbfood.Backend.service.NotificacionInvitacionService;
import com.upbfood.Backend.service.NotificacionSolicitudRegistroService;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * HU031 - Panel del encargado institucional de la UPB.
 *
 * Permite listar las solicitudes de registro de cafeterías (HU030) y
 * aprobarlas o rechazarlas sin depender de que el servidor de correo esté
 * configurado. El acceso se protege con una clave institucional definida en
 * la variable de entorno APP_UPB_REVISOR_CLAVE y enviada en la cabecera
 * X-UPB-Revisor-Clave. Si la variable no está configurada, el panel queda
 * deshabilitado y responde 403.
 */
@RestController
@RequestMapping("/api/upb/solicitudes")
public class RevisionUniversidadController {

    public static final String HEADER_CLAVE = "X-UPB-Revisor-Clave";
    private static final Set<String> ESTADOS = Set.of("PENDIENTE", "APROBADA", "RECHAZADA", "TODAS");

    private final SolicitudRegistroRestauranteRepository repository;
    private final AprobacionSolicitudService aprobacionService;
    private final NotificacionInvitacionService notificacionInvitacionService;
    private final NotificacionSolicitudRegistroService notificacionSolicitudService;
    private final String claveRevisor;

    public RevisionUniversidadController(
            SolicitudRegistroRestauranteRepository repository,
            AprobacionSolicitudService aprobacionService,
            NotificacionInvitacionService notificacionInvitacionService,
            NotificacionSolicitudRegistroService notificacionSolicitudService,
            @Value("${app.upb.revisor-clave:}") String claveRevisor) {
        this.repository = repository;
        this.aprobacionService = aprobacionService;
        this.notificacionInvitacionService = notificacionInvitacionService;
        this.notificacionSolicitudService = notificacionSolicitudService;
        this.claveRevisor = claveRevisor == null ? "" : claveRevisor.trim();
    }

    public record RechazoRequest(@Size(max = 500) String observacion) {
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listar(
            @RequestHeader(value = HEADER_CLAVE, required = false) String clave,
            @RequestParam(defaultValue = "PENDIENTE") String estado) {
        validarClave(clave);

        String estadoNormalizado = estado == null ? "PENDIENTE" : estado.trim().toUpperCase();
        if (!ESTADOS.contains(estadoNormalizado)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Estado inválido. Usa PENDIENTE, APROBADA, RECHAZADA o TODAS.");
        }

        List<SolicitudRegistroRestaurante> solicitudes = "TODAS".equals(estadoNormalizado)
                ? repository.findAll().stream()
                        .sorted((a, b) -> {
                            if (a.getFechaSolicitud() == null || b.getFechaSolicitud() == null) {
                                return 0;
                            }
                            return b.getFechaSolicitud().compareTo(a.getFechaSolicitud());
                        })
                        .toList()
                : repository.findByEstadoOrderByFechaSolicitudDesc(estadoNormalizado);

        return ResponseEntity.ok(solicitudes.stream().map(this::mapear).toList());
    }

    @PostMapping("/{id}/aprobar")
    public ResponseEntity<Map<String, Object>> aprobar(
            @RequestHeader(value = HEADER_CLAVE, required = false) String clave,
            @PathVariable Long id) {
        validarClave(clave);

        AprobacionSolicitudService.ResultadoAprobacion resultado = aprobacionService.aprobar(id);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("solicitudId", resultado.solicitudId());
        response.put("estado", "APROBADA");
        // El encargado siempre recibe el enlace para poder entregarlo si el correo no llega.
        response.put("enlaceActivacion", resultado.enlace());
        try {
            notificacionInvitacionService.enviarInvitacion(resultado.correoDestino(), resultado.enlace());
            response.put("correoEnviado", true);
            response.put("mensaje",
                    "Solicitud aprobada. Se envió al solicitante el enlace para activar su cuenta de dueño.");
        } catch (IllegalStateException e) {
            // Sin servidor de correo, el encargado recibe el enlace para entregarlo manualmente.
            response.put("correoEnviado", false);
            response.put("mensaje",
                    "Solicitud aprobada, pero no se pudo enviar el correo. Comparte el enlace de activación con el solicitante.");
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/rechazar")
    public ResponseEntity<Map<String, Object>> rechazar(
            @RequestHeader(value = HEADER_CLAVE, required = false) String clave,
            @PathVariable Long id,
            @RequestBody(required = false) RechazoRequest request) {
        validarClave(clave);

        String observacion = request == null ? null : request.observacion();
        if (observacion != null && observacion.length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La observación no puede superar 500 caracteres.");
        }

        SolicitudRegistroRestaurante solicitud = aprobacionService.rechazar(id, observacion);
        boolean correoEnviado = notificacionSolicitudService.enviarNotificacionRechazo(solicitud);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("solicitudId", solicitud.getId());
        response.put("estado", solicitud.getEstado());
        response.put("correoEnviado", correoEnviado);
        response.put("mensaje", correoEnviado
                ? "Solicitud rechazada. Se notificó al solicitante por correo."
                : "Solicitud rechazada. No se pudo enviar el correo al solicitante.");
        return ResponseEntity.ok(response);
    }

    private void validarClave(String clave) {
        if (claveRevisor.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "El panel institucional está deshabilitado. Configura APP_UPB_REVISOR_CLAVE en el servidor.");
        }
        if (clave == null || clave.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Ingresa la clave del encargado de la universidad.");
        }
        boolean coincide = MessageDigest.isEqual(
                claveRevisor.getBytes(StandardCharsets.UTF_8),
                clave.trim().getBytes(StandardCharsets.UTF_8));
        if (!coincide) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "La clave del encargado de la universidad no es válida.");
        }
    }

    private Map<String, Object> mapear(SolicitudRegistroRestaurante solicitud) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", solicitud.getId());
        item.put("nombreSolicitante", solicitud.getNombreSolicitante());
        item.put("telefonoSolicitante", solicitud.getTelefonoSolicitante());
        item.put("correoSolicitante", solicitud.getCorreoSolicitante());
        item.put("nombreRestaurante", solicitud.getNombreRestaurante());
        item.put("ubicacionRestaurante", solicitud.getUbicacionRestaurante());
        item.put("tiempoPreparacionMin", solicitud.getTiempoPreparacionMin());
        item.put("estado", solicitud.getEstado());
        item.put("fechaSolicitud", solicitud.getFechaSolicitud());
        item.put("fechaRevision", solicitud.getFechaRevision());
        item.put("observacionRevision", solicitud.getObservacionRevision());
        return item;
    }
}
