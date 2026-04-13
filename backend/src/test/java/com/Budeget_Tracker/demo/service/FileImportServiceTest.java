package com.Budeget_Tracker.demo.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.Budeget_Tracker.demo.dto.finance.FileImportResponse;
import com.Budeget_Tracker.demo.dto.finance.TransactionRequest;
import com.Budeget_Tracker.demo.model.FinanceTransaction;
import com.Budeget_Tracker.demo.model.TransactionType;
import com.Budeget_Tracker.demo.repository.FinanceTransactionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

class FileImportServiceTest {

    @Test
    void importsMeinElbaCsvWithoutHeaderAndSplitsIncomeExpense() {
        FinanceTransactionRepository repository = mock(FinanceTransactionRepository.class);
        when(repository.findByUserIdAndDateGreaterThanEqualAndDateLessThanEqual(
                eq(77L),
                eq(LocalDate.of(2023, 3, 1)),
                eq(LocalDate.of(2023, 3, 2))
        )).thenReturn(List.of());
        when(repository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        TransactionService transactionService = new TransactionService(repository);

        FileImportService fileImportService = new FileImportService(new ObjectMapper(), transactionService);

        String csv = "\uFEFF01.03.2023;\"Eingang Auftraggeber: Test Auftragsart: SEPA Ueberweisung SCT\";01.03.2023;85,00;EUR;01.03.2023 05:26:13:113\n"
                + "02.03.2023;\"POS 6,79 Verwendungszweck: BILLA DANKT HALLEIN 5400 Weiterer Verwendungszweck: BelegRef: 12345 Kartenzahlung\";02.03.2023;-6,79;EUR;02.03.2023 10:23:43:611\n";

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "meinElba.csv",
                "text/csv",
                csv.getBytes(StandardCharsets.UTF_8)
        );

        FileImportResponse response = fileImportService.importTransactions(77L, file);

        assertThat(response.importedTransactions()).isEqualTo(2);

        @SuppressWarnings({"rawtypes", "unchecked"})
        ArgumentCaptor<List<FinanceTransaction>> captor = ArgumentCaptor.forClass((Class) List.class);
        verify(repository).saveAll(captor.capture());

        List<FinanceTransaction> requests = captor.getValue();
        assertThat(requests).hasSize(2);

        FinanceTransaction income = requests.get(0);
        assertThat(income.getType()).isEqualTo(TransactionType.INCOME);
        assertThat(income.getAmount()).isEqualByComparingTo("85.00");
        assertThat(income.getCategory()).isEqualTo("Ueberweisung Eingang");
        assertThat(income.getDate()).isEqualTo(LocalDate.of(2023, 3, 1));

        FinanceTransaction expense = requests.get(1);
        assertThat(expense.getType()).isEqualTo(TransactionType.EXPENSE);
        assertThat(expense.getAmount()).isEqualByComparingTo("6.79");
        assertThat(expense.getCategory()).isEqualTo("BILLA DANKT HALLEIN 5400");
        assertThat(expense.getDate()).isEqualTo(LocalDate.of(2023, 3, 2));
    }

    @Test
    void skipsExactDuplicateTransactionsOnImport() {
        FinanceTransaction existing = new FinanceTransaction();
        existing.setUserId(77L);
        existing.setAmount(new BigDecimal("85.00"));
        existing.setType(TransactionType.INCOME);
        existing.setCategory("Ueberweisung Eingang");
        existing.setDescription("Eingang Auftraggeber: Test Auftragsart: SEPA Ueberweisung SCT");
        existing.setDate(LocalDate.of(2023, 3, 1));

        FinanceTransactionRepository repository = mock(FinanceTransactionRepository.class);
        when(repository.findByUserIdAndDateGreaterThanEqualAndDateLessThanEqual(
                eq(77L),
                eq(LocalDate.of(2023, 3, 1)),
                eq(LocalDate.of(2023, 3, 1))
        )).thenReturn(List.of(existing));

        TransactionService transactionService = new TransactionService(repository);
        FileImportService fileImportService = new FileImportService(new ObjectMapper(), transactionService);

        String csv = "\uFEFF01.03.2023;\"Eingang Auftraggeber: Test Auftragsart: SEPA Ueberweisung SCT\";01.03.2023;85,00;EUR;01.03.2023 05:26:13:113\n";

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "meinElba.csv",
                "text/csv",
                csv.getBytes(StandardCharsets.UTF_8)
        );

        FileImportResponse response = fileImportService.importTransactions(77L, file);

        assertThat(response.importedTransactions()).isEqualTo(0);
        verify(repository, never()).saveAll(anyList());
    }
}
