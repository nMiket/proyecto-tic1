package com.upbfood.Backend;

import com.upbfood.Backend.controller.RevisionUniversidadController;
import com.upbfood.Backend.entity.SolicitudRegistroRestaurante;
import com.upbfood.Backend.repository.SolicitudRegistroRestauranteRepository;
import com.upbfood.Backend.service.AprobacionSolicitudService;
import com.upbfood.Backend.service.NotificacionInvitacionService;
import com.upbfood.Backend.service.NotificacionSolicitudRegistroService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * HU031 - Panel de aprobación del encargado de la universidad.
 */
class RevisionUniversidadControllerTest {

    private static final String CLAVE = "clave-institucional-de-prueba";

    private final SolicitudRegistroRestauranteRepository repository =
            mock(SolicitudRegistroRestauranteRepository.class);
    private final AprobacionSolicitudService aprobacionService = mock(AprobacionSolicitudService.class);
    private final NotificacionInvitacionService invitacionService = mock(NotificacionInvitacionService.class);
    private final NotificacionSolicitudRegistroService solicitudService =
            mock(NotificacionSolicitudRegistroService.class);

    private RevisionUniversidadController controller(String clave) {
        return new RevisionUniversidadController(
                repository, aprobacionService, invitacionService, solicitudService, clave);
    }

    @Test
    void panelDeshabilitadoSinClaveConfigurada() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> controller("").listar("cualquier", "PENDIENTE"));
        assertEquals(403, ex.getStatusCode().value());
        verifyNoInteractions(repository);
    }

    @Test
    void rechazaPeticionesSinClaveOConClaveIncorrecta() {
        RevisionUniversidadController controller = controller(CLAVE);

        ResponseStatusException sinClave = assertThrows(ResponseStatusException.class,
                () -> controller.listar(null, "PENDIENTE"));
        assertEquals(401, sinClave.getStatusCode().value());

        ResponseStatusException claveIncorrecta = assertThrows(ResponseStatusException.class,
                () -> controller.aprobar("otra-clave", 1L));
        assertEquals(403, claveIncorrecta.getStatusCode().value());
        verifyNoInteractions(aprobacionService);
    }

    @Test
    void listaSolicitudesPendientes() {
        SolicitudRegistroRestaurante solicitud = new SolicitudRegistroRestaurante();
        solicitud.setCorreoSolicitante("nuevo@upb.edu.co");
        solicitud.setEstado("PENDIENTE");
        when(repository.findByEstadoOrderByFechaSolicitudDesc("PENDIENTE")).thenReturn(List.of(solicitud));

        ResponseEntity<List<Map<String, Object>>> response = controller(CLAVE).listar(CLAVE, "pendiente");

        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().size());
        assertEquals("nuevo@upb.edu.co", response.getBody().get(0).get("correoSolicitante"));
    }

    @Test
    void estadoDeFiltroInvalidoDevuelve400() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> controller(CLAVE).listar(CLAVE, "BORRADA"));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void aprobarDevuelveEnlaceSiNoSePuedeEnviarCorreo() {
        when(aprobacionService.aprobar(5L)).thenReturn(new AprobacionSolicitudService.ResultadoAprobacion(
                5L, null, "nuevo@upb.edu.co", "http://localhost/configurar-invitacion?token=abc", null));
        doThrow(new IllegalStateException("sin correo"))
                .when(invitacionService).enviarInvitacion("nuevo@upb.edu.co",
                        "http://localhost/configurar-invitacion?token=abc");

        ResponseEntity<Map<String, Object>> response = controller(CLAVE).aprobar(CLAVE, 5L);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("APROBADA", response.getBody().get("estado"));
        assertEquals(false, response.getBody().get("correoEnviado"));
        assertEquals("http://localhost/configurar-invitacion?token=abc",
                response.getBody().get("enlaceActivacion"));
    }

    @Test
    void rechazarRegistraObservacionYNotifica() {
        SolicitudRegistroRestaurante rechazada = new SolicitudRegistroRestaurante();
        rechazada.setEstado("RECHAZADA");
        when(aprobacionService.rechazar(8L, "Ubicación no autorizada")).thenReturn(rechazada);
        when(solicitudService.enviarNotificacionRechazo(rechazada)).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller(CLAVE).rechazar(
                CLAVE, 8L, new RevisionUniversidadController.RechazoRequest("Ubicación no autorizada"));

        assertEquals("RECHAZADA", response.getBody().get("estado"));
        assertEquals(true, response.getBody().get("correoEnviado"));
        verify(aprobacionService).rechazar(8L, "Ubicación no autorizada");
    }
}
