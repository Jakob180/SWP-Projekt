package com.Budeget_Tracker.demo.service;

import com.Budeget_Tracker.demo.model.VerificationPurpose;
import java.util.concurrent.CompletableFuture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class VerificationMailService {
    private static final Logger log = LoggerFactory.getLogger(VerificationMailService.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public VerificationMailService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.mail.from:noreply@finance-dashboard.local}") String fromAddress
    ) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.fromAddress = fromAddress;
    }

    public void sendVerificationCode(String recipient, VerificationPurpose purpose, String code, int expiresMinutes) {
        String subject = purpose == VerificationPurpose.REGISTER
                ? "Registrierungscode"
                : "Code fuer Passwortaenderung";
        String body = "Dein Verifizierungscode ist: " + code + "\n\n"
                + "Der Code ist " + expiresMinutes + " Minuten gueltig.";

        if (mailSender == null) {
            log.warn("No SMTP configured. Verification code for {} ({}): {}", recipient, purpose, code);
            return;
        }

        CompletableFuture.runAsync(() -> {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                if (fromAddress != null && !fromAddress.isBlank()) {
                    message.setFrom(fromAddress);
                }
                message.setTo(recipient);
                message.setSubject(subject);
                message.setText(body);
                mailSender.send(message);
            } catch (Exception ex) {
                log.warn("Could not send verification email to {}: {}", recipient, ex.getMessage());
                log.warn("Fallback verification code for {} ({}): {}", recipient, purpose, code);
            }
        });
    }
}
