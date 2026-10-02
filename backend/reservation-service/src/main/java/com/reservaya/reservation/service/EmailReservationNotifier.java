package com.reservaya.reservation.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import com.reservaya.reservation.entity.Reservation;

@Component
public class EmailReservationNotifier implements ReservationNotifier {

    private static final Logger log = LoggerFactory.getLogger(EmailReservationNotifier.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    private final boolean smtpConfigured;
    private final String from;

    public EmailReservationNotifier(ObjectProvider<JavaMailSender> mailSender,
                                    @Value("${spring.mail.host:}") String mailHost,
                                    @Value("${reservaya.mail.from:no-reply@reservaya.local}") String from) {
        this.mailSender = mailSender;
        this.smtpConfigured = !mailHost.isBlank();
        this.from = from;
    }

    @Override
    public void notifyCustomer(Reservation reservation, String subject, String message) {
        String recipient = reservation.getCustomerEmail();
        if (recipient == null || recipient.isBlank()) {
            log.warn("No se puede notificar la reserva {}: no tiene correo de cliente.", reservation.getId());
            return;
        }

        JavaMailSender sender = smtpConfigured ? mailSender.getIfAvailable() : null;
        if (sender == null) {
            log.info("SMTP sin configurar. Notificación para {}: {}", recipient, message);
            return;
        }

        SimpleMailMessage email = new SimpleMailMessage();
        email.setFrom(from);
        email.setTo(recipient);
        email.setSubject(subject);
        email.setText(message);
        try {
            sender.send(email);
        } catch (MailException exception) {
            log.error("No se pudo enviar la notificación de la reserva {}.", reservation.getId(), exception);
        }
    }
}