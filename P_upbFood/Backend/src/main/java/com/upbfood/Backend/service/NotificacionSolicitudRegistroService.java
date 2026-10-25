package com.upbfood.Backend.service;

import com.upbfood.Backend.entity.SolicitudRegistroRestaurante;
import com.upbfood.Backend.repository.SolicitudRegistroRestauranteRepository;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest; 
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class NotificacionSolicitudRegistroService {

    private static final Logger log =
            LoggerFactory.getLogger(NotificacionSolicitudRegistroService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final JavaMailSender mailSender;
    private final SolicitudRegistroRestauranteRepository repository;

    @Value("${spring.mail.username:}")
    private String correoRemitente;

    @Value("${app.notificaciones.correo-destino:}")
    private String correoDestino;

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    public NotificacionSolicitudRegistroService(
            JavaMailSender mailSender,
            SolicitudRegistroRestauranteRepository repository) {
        this.mailSender = mailSender;
        this.repository = repository;
    }

    public void enviarNotificacion(SolicitudRegistroRestaurante solicitud) {
        String tokenAprobacion = generarToken();
        String tokenRechazo = generarToken();

        solicitud.setTokenAprobacionHash(hashToken(tokenAprobacion));
        solicitud.setTokenRechazoHash(hashToken(tokenRechazo));
        solicitud.setTokenRevisionExpiracion(LocalDateTime.now().plusHours(48));
        repository.save(solicitud);

        if (!StringUtils.hasText(correoRemitente)
                || !StringUtils.hasText(correoDestino)) {
            log.warn("Correo de revisión no enviado: falta configurar MAIL_USERNAME o APP_NOTIFICACIONES_CORREO_DESTINO.");
            return;
        }

        String baseUrl = frontendUrl.replaceAll("/+$", "");
        String enlaceAprobar = baseUrl + "/revisar-solicitud?token="
                + tokenAprobacion + "&accion=aprobar";
        String enlaceRechazar = baseUrl + "/revisar-solicitud?token="
                + tokenRechazo + "&accion=rechazar";

        try {
            MimeMessage mensaje = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mensaje, true, "UTF-8");
            helper.setFrom(correoRemitente);
            helper.setTo(correoDestino);
            helper.setSubject("UPBFood - Solicitud de registro de restaurante #" + solicitud.getId());

            String html = """
                    <html>
                    <body style="font-family:Arial,sans-serif;color:#24332f;line-height:1.5">
                      <h2>Nueva solicitud de restaurante en UPBFood</h2>
                      <p>Se recibió una solicitud. Revisa los datos y selecciona una decisión.</p>
                      <h3>Datos del solicitante</h3>
                      <p><strong>Nombre:</strong> %s<br>
                      <strong>Teléfono:</strong> %s<br>
                      <strong>Correo:</strong> %s</p>
                      <h3>Datos del restaurante</h3>
                      <p><strong>Nombre:</strong> %s<br>
                      <strong>Ubicación:</strong> %s<br>
                      <strong>Tiempo de preparación:</strong> %s minutos<br>
                      <strong>Solicitud:</strong> #%s</p>
                      <p style="margin:28px 0">
                        <a href="%s" style="background:#16834a;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Aprobar solicitud</a>
                        &nbsp;
                        <a href="%s" style="background:#b42318;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Rechazar solicitud</a>
                      </p>
                      <p>Los enlaces vencen en 48 horas y solo permiten una decisión. Al abrirlos se mostrará una confirmación; la solicitud no se modifica hasta confirmar.</p>
                      <p>Equipo UPBFood</p>
                    </body>
                    </html>
                    """.formatted(
                    escaparHtml(solicitud.getNombreSolicitante()),
                    escaparHtml(solicitud.getTelefonoSolicitante()),
                    escaparHtml(solicitud.getCorreoSolicitante()),
                    escaparHtml(solicitud.getNombreRestaurante()),
                    escaparHtml(solicitud.getUbicacionRestaurante()),
                    solicitud.getTiempoPreparacionMin(),
                    solicitud.getId(),
                    enlaceAprobar,
                    enlaceRechazar);

            helper.setText(html, true);
            mailSender.send(mensaje);
            log.info("Correo de revisión enviado para solicitud {}", solicitud.getId());
        } catch (MessagingException | MailException e) {
            log.error("No se pudo enviar el correo de revisión para solicitud {}", solicitud.getId(), e);
        }
    }

    public boolean enviarNotificacionRechazo(SolicitudRegistroRestaurante solicitud) {
        if (!StringUtils.hasText(correoRemitente)
                || !StringUtils.hasText(solicitud.getCorreoSolicitante())) {
            log.warn("Correo de rechazo no enviado para solicitud {}: falta configurar MAIL_USERNAME o el correo del solicitante.", solicitud.getId());
            return false;
        }

        String observacion = StringUtils.hasText(solicitud.getObservacionRevision())
                ? escaparHtml(solicitud.getObservacionRevision().trim())
                : "No se indicó un motivo específico para el rechazo.";

        try {
            MimeMessage mensaje = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mensaje, true, "UTF-8");
            helper.setFrom(correoRemitente);
            helper.setTo(solicitud.getCorreoSolicitante());
            helper.setSubject("UPBFood - Actualización de tu solicitud de restaurante #" + solicitud.getId());

            String html = """
                    <html>
                    <body style="font-family:Arial,sans-serif;color:#24332f;line-height:1.5">
                      <h2>Actualización de tu solicitud en UPBFood</h2>
                      <p>Hola %s,</p>
                      <p>Gracias por tu interés en registrar <strong>%s</strong> en UPBFood.
                      Después de revisar la información, lamentamos informarte que la solicitud fue rechazada.</p>
                      <p><strong>Motivo u observación:</strong><br>%s</p>
                      <p><strong>Número de solicitud:</strong> #%s</p>
                      <p>Si tienes dudas sobre esta decisión, puedes responder a este correo para solicitar más información.</p>
                      <p>Equipo UPBFood</p>
                    </body>
                    </html>
                    """.formatted(
                    escaparHtml(solicitud.getNombreSolicitante()),
                    escaparHtml(solicitud.getNombreRestaurante()),
                    observacion.replace("\n", "<br>"),
                    solicitud.getId());

            helper.setText(html, true);
            mailSender.send(mensaje);
            log.info("Correo de rechazo enviado al solicitante de la solicitud {}", solicitud.getId());
            return true;
        } catch (MessagingException | MailException e) {
            log.error("No se pudo enviar el correo de rechazo para solicitud {}", solicitud.getId(), e);
            return false;
        }
    }

    public String hashToken(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no está disponible.", e);
        }
    }

    private String generarToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String escaparHtml(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
