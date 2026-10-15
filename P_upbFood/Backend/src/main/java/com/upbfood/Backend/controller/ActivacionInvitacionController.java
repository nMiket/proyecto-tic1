
package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.ActivarInvitacionRequest;
import com.upbfood.Backend.service.ActivacionInvitacionService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    public record ActivarCuentaRequest(
            @NotBlank @Size(max = 200) String token,
            @NotBlank @Size(min = 8, max = 72) String password
    ) {}
}
