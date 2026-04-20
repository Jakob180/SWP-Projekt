package com.Budeget_Tracker.demo.service;

import com.Budeget_Tracker.demo.model.EmailVerificationCode;
import com.Budeget_Tracker.demo.model.VerificationPurpose;
import com.Budeget_Tracker.demo.repository.EmailVerificationCodeRepository;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EmailVerificationService {
    private static final SecureRandom RANDOM = new SecureRandom();

    private final EmailVerificationCodeRepository emailVerificationCodeRepository;
    private final VerificationMailService verificationMailService;
    private final int expiresMinutes;

    public EmailVerificationService(
            EmailVerificationCodeRepository emailVerificationCodeRepository,
            VerificationMailService verificationMailService,
            @Value("${auth.verification.expiration-minutes:10}") int expiresMinutes
    ) {
        this.emailVerificationCodeRepository = emailVerificationCodeRepository;
        this.verificationMailService = verificationMailService;
        this.expiresMinutes = expiresMinutes;
    }

    public void requestRegistrationCode(String username, String email, String passwordHash) {
        EmailVerificationCode entry = emailVerificationCodeRepository
                .findByEmailAndPurpose(email, VerificationPurpose.REGISTER)
                .orElseGet(EmailVerificationCode::new);

        entry.setEmail(email);
        entry.setPurpose(VerificationPurpose.REGISTER);
        entry.setCode(generateCode());
        entry.setExpiresAt(LocalDateTime.now().plusMinutes(expiresMinutes));
        entry.setPendingUsername(username);
        entry.setPendingPasswordHash(passwordHash);

        EmailVerificationCode saved = emailVerificationCodeRepository.save(entry);
        verificationMailService.sendVerificationCode(email, VerificationPurpose.REGISTER, saved.getCode(), expiresMinutes);
    }

    public PendingRegistration confirmRegistration(String email, String code) {
        EmailVerificationCode entry = emailVerificationCodeRepository
                .findByEmailAndPurpose(email, VerificationPurpose.REGISTER)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No registration code requested"));

        validateCode(entry, code);

        String username = entry.getPendingUsername();
        String passwordHash = entry.getPendingPasswordHash();
        emailVerificationCodeRepository.delete(entry);

        if (username == null || username.isBlank() || passwordHash == null || passwordHash.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid registration code payload");
        }

        return new PendingRegistration(username, email, passwordHash);
    }

    public void requestPasswordResetCode(String email) {
        EmailVerificationCode entry = emailVerificationCodeRepository
                .findByEmailAndPurpose(email, VerificationPurpose.PASSWORD_RESET)
                .orElseGet(EmailVerificationCode::new);

        entry.setEmail(email);
        entry.setPurpose(VerificationPurpose.PASSWORD_RESET);
        entry.setCode(generateCode());
        entry.setExpiresAt(LocalDateTime.now().plusMinutes(expiresMinutes));
        entry.setPendingUsername(null);
        entry.setPendingPasswordHash(null);

        EmailVerificationCode saved = emailVerificationCodeRepository.save(entry);
        verificationMailService.sendVerificationCode(email, VerificationPurpose.PASSWORD_RESET, saved.getCode(), expiresMinutes);
    }

    public void validatePasswordResetCode(String email, String code) {
        EmailVerificationCode entry = emailVerificationCodeRepository
                .findByEmailAndPurpose(email, VerificationPurpose.PASSWORD_RESET)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "No password reset code requested"));

        validateCode(entry, code);
    }

    public void clearPasswordResetCode(String email) {
        emailVerificationCodeRepository.deleteByEmailAndPurpose(email, VerificationPurpose.PASSWORD_RESET);
    }

    private void validateCode(EmailVerificationCode entry, String code) {
        if (entry.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verification code expired");
        }

        if (!entry.getCode().equals(code)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid verification code");
        }
    }

    private String generateCode() {
        int value = RANDOM.nextInt(1_000_000);
        return String.format("%06d", value);
    }

    public record PendingRegistration(String username, String email, String passwordHash) {
    }
}
