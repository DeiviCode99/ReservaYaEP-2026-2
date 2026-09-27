package com.reservaya.auth.service;

import com.reservaya.auth.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Envía el enlace de recuperación. Sin SMTP configurado (SPRING_MAIL_HOST
 * vacío, típico en desarrollo) Spring no crea el JavaMailSender y el enlace
 * se escribe en el log del servicio para poder probar el flujo.
 */
@Component
public class ResetMailer {

    private static final Logger log = LoggerFactory.getLogger(ResetMailer.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    private final boolean smtpConfigured;
    private final String frontendUrl;
    private final String from;
    private final long ttlMinutes;

    public ResetMailer(ObjectProvider<JavaMailSender> mailSender,
                       // "SPRING_MAIL_HOST=" vacío en el .env también cuenta como sin SMTP.
                       @Value("${spring.mail.host:}") String mailHost,
                       @Value("${reservaya.frontend-url}") String frontendUrl,
                       @Value("${reservaya.mail.from}") String from,
                       @Value("${reservaya.reset.expiration-minutes:30}") long ttlMinutes) {
        this.mailSender = mailSender;
        this.smtpConfigured = !mailHost.isBlank();
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
        this.from = from;
        this.ttlMinutes = ttlMinutes;
    }

    public void send(User user, String token) {
        String link = frontendUrl + "/html/recuperar.html?token=" + token;
        JavaMailSender sender = smtpConfigured ? mailSender.getIfAvailable() : null;
        if (sender == null) {
            log.warn("SMTP sin configurar. Enlace de recuperación para {}: {}", user.getEmail(), link);
            return;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(user.getEmail());
        message.setSubject("Recupera tu cuenta de ReservaYa");
        message.setText("Hola, " + user.getName() + ".\n\n"
                + "Recibimos una solicitud para cambiar la contraseña de tu cuenta de ReservaYa.\n"
                + "Abre este enlace para elegir una nueva (vence en " + ttlMinutes + " minutos):\n\n"
                + link + "\n\n"
                + "Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.");
        try {
            sender.send(message);
        } catch (MailException e) {
            // No se informa al cliente para no revelar qué correos existen.
            log.error("No se pudo enviar el correo de recuperación a {}", user.getEmail(), e);
        }
    }
}
