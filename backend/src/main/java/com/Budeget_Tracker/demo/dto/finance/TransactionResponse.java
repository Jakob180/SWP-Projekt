package com.Budeget_Tracker.demo.dto.finance;

import com.Budeget_Tracker.demo.model.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDate;

public record TransactionResponse(
        Long id,
        BigDecimal amount,
        TransactionType type,
        String category,
        String description,
        LocalDate date
) {
}
