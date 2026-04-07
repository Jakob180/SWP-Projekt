package com.Budeget_Tracker.demo.dto.finance;

import java.time.LocalDate;

public record FileImportResponse(int importedTransactions, LocalDate importedFrom, LocalDate importedTo) {
}
