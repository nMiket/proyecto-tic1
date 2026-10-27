
package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.ActivarInvitacionRequest;
import com.upbfood.Backend.service.ActivacionInvitacionService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/invitaciones")
public class ActivacionInvitacionController {

    private final ActivacionInvitacionService activacionService;

    public ActivacionInvitacionController(
            ActivacionInvitacionService activacionService
    ) {
        this.activacionService = activacionService;
    }

    public record ActivarRequest(
            @NotBlank @Size(max = 200) String token,
            @Valid ActivarInvitacionRequest cuenta
    ) {}

    @PostMapping("/activar")
    public ResponseEntity<Map<String, String>> activar(
            @Valid @RequestBody ActivarCuentaRequest request
    ) {
        activacionService.activar(
                request.token(),
                request.password()
        );

        return ResponseEntity.ok(Map.of(
                "mensaje",
                "Cuenta activada correctamente. Ya puedes iniciar sesión."
        ));
    }

    /**
     * Devuelve el estado y el motivo reales (inválida, usada, expirada...) en el cuerpo JSON.
     * Sin esto, Spring reenvía a /error, que SecurityConfig no permite, y el cliente recibe
     * una respuesta vacía en lugar del motivo.
     */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> manejarEstado(ResponseStatusException exception) {
        String motivo = exception.getReason() != null
                ? exception.getReason()
                : "No fue posible activar la cuenta.";
        return ResponseEntity.status(exception.getStatusCode())
                .body(Map.of("mensaje", motivo));
    }

    public record ActivarCuentaRequest(
            @NotBlank @Size(max = 200) String token,
            @NotBlank @Size(min = 8, max = 72) String password
    ) {}
}
