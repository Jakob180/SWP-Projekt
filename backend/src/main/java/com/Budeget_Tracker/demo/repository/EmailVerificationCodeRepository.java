package com.Budeget_Tracker.demo.repository;

import com.Budeget_Tracker.demo.model.EmailVerificationCode;
import com.Budeget_Tracker.demo.model.VerificationPurpose;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailVerificationCodeRepository extends JpaRepository<EmailVerificationCode, Long> {
    Optional<EmailVerificationCode> findByEmailAndPurpose(String email, VerificationPurpose purpose);

    void deleteByEmailAndPurpose(String email, VerificationPurpose purpose);

    void deleteByEmail(String email);
}
