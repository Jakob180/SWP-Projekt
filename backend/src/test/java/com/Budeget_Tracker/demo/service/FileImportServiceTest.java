package com.Budeget_Tracker.demo.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.Budeget_Tracker.demo.dto.finance.FileImportResponse;
import com.Budeget_Tracker.demo.dto.finance.TransactionRequest;
import com.Budeget_Tracker.demo.model.TransactionType;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

class FileImportServiceTest {

    @Test
    void importsMeinElbaCsvWithoutHeaderAndSplitsIncomeExpense() {
        TransactionService transactionService = mock(TransactionService.class);
        when(transactionService.importTransactions(eq(77L), anyList()))
                .thenAnswer(invocation -> ((List<?>) invocation.getArgument(1)).size());

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
        ArgumentCaptor<List<TransactionRequest>> captor = ArgumentCaptor.forClass((Class) List.class);
        verify(transactionService).importTransactions(eq(77L), captor.capture());

        List<TransactionRequest> requests = captor.getValue();
        assertThat(requests).hasSize(2);

        TransactionRequest income = requests.get(0);
        assertThat(income.type()).isEqualTo(TransactionType.INCOME);
        assertThat(income.amount()).isEqualByComparingTo("85.00");
        assertThat(income.category()).isEqualTo("Ueberweisung Eingang");
        assertThat(income.date()).isEqualTo(LocalDate.of(2023, 3, 1));

        TransactionRequest expense = requests.get(1);
        assertThat(expense.type()).isEqualTo(TransactionType.EXPENSE);
        assertThat(expense.amount()).isEqualByComparingTo("6.79");
        assertThat(expense.category()).isEqualTo("BILLA DANKT HALLEIN 5400");
        assertThat(expense.date()).isEqualTo(LocalDate.of(2023, 3, 2));
    }
}
