package com.Budeget_Tracker.demo.repository;

import com.Budeget_Tracker.demo.model.UserLoginProfile;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserLoginProfileRepository extends JpaRepository<UserLoginProfile, Long> {
    Optional<UserLoginProfile> findByUsernameAndEmailIgnoreCase(String username, String email);

    Optional<UserLoginProfile> findByUsername(String username);

    Optional<UserLoginProfile> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    void deleteByUsername(String username);
}
