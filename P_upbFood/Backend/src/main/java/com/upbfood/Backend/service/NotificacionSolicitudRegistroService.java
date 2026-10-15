
package com.upbfood.Backend.service;

import com.upbfood.Backend.entity.SolicitudRegistroRestaurante;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class NotificacionSolicitudRegistroService {

    private static final Logger log =
            LoggerFactory.getLogger(
                    NotificacionSolicitudRegistroService.class
            );

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String correoRemitente;

    @Value("${app.notificaciones.correo-destino:}")
    private String correoDestino;

    public NotificacionSolicitudRegistroService(
            JavaMailSender mailSender
    ) {
        this.mailSender = mailSender;
    }

    public void enviarNotificacion(
            SolicitudRegistroRestaurante solicitud
    ) {
        if (!StringUtils.hasText(correoRemitente)
                || !StringUtils.hasText(correoDestino)) {
            log.warn(
                    "Notificación no enviada: falta configurar el correo."
            );
            return;
        }

        SimpleMailMessage mensaje = new SimpleMailMessage();

        mensaje.setFrom(correoRemitente);
        mensaje.setTo(correoDestino);
        mensaje.setSubject(
                "UPBFood - Nueva solicitud de registro de restaurante"
        );

        mensaje.setText(
                "Se ha recibido una nueva solicitud de registro.\n\n"
                + "Número de solicitud: " + solicitud.getId() + "\n"
                + "Estado: " + solicitud.getEstado() + "\n\n"
                + "DATOS DEL SOLICITANTE\n"
                + "Nombre: " + solicitud.getNombreSolicitante() + "\n"
                + "Teléfono: " + solicitud.getTelefonoSolicitante() + "\n"
                + "Correo: " + solicitud.getCorreoSolicitante() + "\n\n"
                + "DATOS DEL RESTAURANTE\n"
                + "Nombre: " + solicitud.getNombreRestaurante() + "\n"
                + "Ubicación: " + solicitud.getUbicacionRestaurante() + "\n"
                + "Tiempo de preparación: "
                + solicitud.getTiempoPreparacionMin() + " minutos\n\n"
                + "Ingresa a UPBFood para revisar esta solicitud."
        );

        try {
            mailSender.send(mensaje);
            log.info(
                    "Notificación enviada para la solicitud {}",
                    solicitud.getId()
            );
        } catch (MailException e) {
            log.error(
                    "No se pudo enviar el correo de la solicitud {}",
                    solicitud.getId(),
                    e
            );
        }
    }
}
