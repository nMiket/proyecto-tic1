
package com.upbfood.Backend.service;

import com.upbfood.Backend.entity.InvitacionAdministrador;
import com.upbfood.Backend.repository.InvitacionAdministradorRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Base64;

@Service
public class InvitacionAdministradorService {

    private final InvitacionAdministradorRepository repository;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    public InvitacionAdministradorService(
            InvitacionAdministradorRepository repository
    ) {
        this.repository = repository;
    }

    public InvitacionCreada crearInvitacion(
            Long solicitudId,
            Integer restauranteId,
            String correo
    ) {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);

        String token = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(bytes);

        InvitacionAdministrador invitacion =
                new InvitacionAdministrador();

        invitacion.setSolicitudId(solicitudId);
        invitacion.setRestauranteId(restauranteId);
        invitacion.setCorreoDestino(correo);
        invitacion.setTokenHash(calcularHash(token));
        invitacion.setFechaExpiracion(
                LocalDateTime.now().plusHours(24)
        );

        repository.save(invitacion);

        String baseUrl = frontendUrl.replaceAll("/+$", "");
        String enlace = baseUrl
                + "/configurar-invitacion?token=" + token;

        return new InvitacionCreada(enlace, invitacion);
    }

    public String calcularHash(String token) {
        try {
            MessageDigest digest =
                    MessageDigest.getInstance("SHA-256");

            byte[] hash = digest.digest(
                    token.getBytes(StandardCharsets.UTF_8)
            );

            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(
                    "No se pudo generar el hash de la invitación.", e
            );
        }
    }

    public record InvitacionCreada(
            String enlace,
            InvitacionAdministrador invitacion
    ) {}
}
