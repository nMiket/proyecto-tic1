
package com.upbfood.Backend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class NotificacionInvitacionService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String correoRemitente;

    public NotificacionInvitacionService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void enviarInvitacion(String correoDestino, String enlace) {
        if (correoRemitente == null || correoRemitente.isBlank()) {
            throw new IllegalStateException(
                    "Falta configurar MAIL_USERNAME para enviar invitaciones."
            );
        }

        try {
            MimeMessage mensaje = mailSender.createMimeMessage();
            MimeMessageHelper helper =
                    new MimeMessageHelper(mensaje, true, "UTF-8");

            helper.setFrom(correoRemitente);
            helper.setTo(correoDestino);
            helper.setSubject("Invitación para administrar tu restaurante en UPBFood");

            helper.setText("""
                    <html>
                    <body>
                        <h2>¡Tu solicitud de restaurante fue aprobada!</h2>
                        <p>Ya puedes configurar tu cuenta de administrador
                        y comenzar a gestionar tu restaurante en UPBFood.</p>
                        <p>
                            <a href="%s">Configurar mi contraseña</a>
                        </p>
                        <p>Este enlace vence en 24 horas y solo puede utilizarse una vez.</p>
                        <p>Si no solicitaste el registro, puedes ignorar este mensaje.</p>
                        <p>Equipo UPBFood</p>
                    </body>
                    </html>
                    """.formatted(enlace), true);

            mailSender.send(mensaje);

        } catch (MessagingException | MailException e) {
            throw new IllegalStateException(
                    "No se pudo enviar la invitación al correo del solicitante.", e
            );
        }
    }
}
