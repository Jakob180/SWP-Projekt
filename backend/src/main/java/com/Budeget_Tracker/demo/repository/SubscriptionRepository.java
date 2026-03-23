package com.Budeget_Tracker.demo.repository;

import com.Budeget_Tracker.demo.model.Subscription;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {
    List<Subscription> findByUserIdOrderByNameAsc(Long userId);

    Optional<Subscription> findByIdAndUserId(Long id, Long userId);
}
