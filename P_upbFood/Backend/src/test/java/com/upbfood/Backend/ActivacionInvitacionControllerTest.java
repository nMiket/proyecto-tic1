package com.upbfood.Backend;

import com.upbfood.Backend.controller.ActivacionInvitacionController;
import com.upbfood.Backend.service.ActivacionInvitacionService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

class ActivacionInvitacionControllerTest {

    private final ActivacionInvitacionController controller =
            new ActivacionInvitacionController(mock(ActivacionInvitacionService.class));

    @Test
    void expiredInvitationKeepsStatusAndReason() {
        ResponseEntity<Map<String, String>> response = controller.manejarEstado(
                new ResponseStatusException(HttpStatus.GONE, "La invitación ha expirado. Solicita una nueva."));

        assertEquals(410, response.getStatusCode().value());
        assertEquals("La invitación ha expirado. Solicita una nueva.", response.getBody().get("mensaje"));
    }

    @Test
    void usedAndInvalidInvitationsAreDistinguished() {
        ResponseEntity<Map<String, String>> usada = controller.manejarEstado(
                new ResponseStatusException(HttpStatus.CONFLICT, "Esta invitación ya fue utilizada."));
        ResponseEntity<Map<String, String>> invalida = controller.manejarEstado(
                new ResponseStatusException(HttpStatus.BAD_REQUEST, "La invitación no existe o no es válida."));

        assertEquals(409, usada.getStatusCode().value());
        assertEquals("Esta invitación ya fue utilizada.", usada.getBody().get("mensaje"));
        assertEquals(400, invalida.getStatusCode().value());
        assertEquals("La invitación no existe o no es válida.", invalida.getBody().get("mensaje"));
    }
}
