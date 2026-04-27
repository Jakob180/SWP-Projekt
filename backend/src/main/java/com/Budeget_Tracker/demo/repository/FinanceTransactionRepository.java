package com.Budeget_Tracker.demo.repository;

import com.Budeget_Tracker.demo.model.FinanceTransaction;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinanceTransactionRepository extends JpaRepository<FinanceTransaction, Long> {
    List<FinanceTransaction> findByUserIdOrderByDateDesc(Long userId);

    List<FinanceTransaction> findByUserIdAndDateBetweenOrderByDateDesc(Long userId, LocalDate from, LocalDate to);

    List<FinanceTransaction> findByUserIdAndDateGreaterThanEqualAndDateLessThanEqualOrderByDateDesc(
            Long userId,
            LocalDate from,
            LocalDate to
    );

    List<FinanceTransaction> findByUserIdAndDateGreaterThanEqualAndDateLessThanEqual(
            Long userId,
            LocalDate from,
            LocalDate to
    );

    Optional<FinanceTransaction> findByIdAndUserId(Long id, Long userId);

    void deleteByUserId(Long userId);
}
