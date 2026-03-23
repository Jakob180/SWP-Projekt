package com.Budeget_Tracker.demo.dto.finance;

import com.Budeget_Tracker.demo.model.TransactionType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record TransactionRequest(
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        @NotNull TransactionType type,
        @NotBlank @Size(max = 80) String category,
        @Size(max = 255) String description,
        @NotNull LocalDate date
) {
}
