package com.Budeget_Tracker.demo.service;

import com.Budeget_Tracker.demo.dto.finance.FileImportResponse;
import com.Budeget_Tracker.demo.dto.finance.TransactionRequest;
import com.Budeget_Tracker.demo.model.TransactionType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class FileImportService {

    private static final DateTimeFormatter[] DATE_FORMATS = {
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("dd.MM.yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy")
    };

    private final ObjectMapper objectMapper;
    private final TransactionService transactionService;

    public FileImportService(ObjectMapper objectMapper, TransactionService transactionService) {
        this.objectMapper = objectMapper;
        this.transactionService = transactionService;
    }

    public FileImportResponse importTransactions(Long userId, MultipartFile file) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Uploaded file is empty");
        }

        String originalFilename = Optional.ofNullable(file.getOriginalFilename())
                .orElse("")
                .toLowerCase(Locale.ROOT);

        List<TransactionRequest> transactions = parseTransactions(file, originalFilename);
        int importedCount = transactionService.importTransactions(userId, transactions);
        return new FileImportResponse(importedCount);
    }

    private List<TransactionRequest> parseTransactions(MultipartFile file, String originalFilename) {
        try {
            if (originalFilename.endsWith(".json")) {
                return parseJson(file.getInputStream());
            }
            if (originalFilename.endsWith(".csv")) {
                return parseCsv(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
            }

            try {
                return parseJson(file.getInputStream());
            } catch (Exception ignored) {
                return parseCsv(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8));
            }
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read uploaded file");
        }
    }

    private List<TransactionRequest> parseJson(InputStream inputStream) throws IOException {
        JsonNode root = objectMapper.readTree(inputStream);
        JsonNode items = root.isArray() ? root : root.path("transactions");

        if (!items.isArray()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "JSON must be an array or contain a transactions array");
        }

        List<TransactionRequest> requests = new ArrayList<>();
        for (JsonNode item : items) {
            requests.add(parseJsonItem(item));
        }

        return requests;
    }

    private TransactionRequest parseJsonItem(JsonNode item) {
        BigDecimal amount = parseAmount(item.path("amount").asText(null));
        TransactionType type = parseType(item.path("type").asText(null), amount);
        String category = item.path("category").asText("Uncategorized").trim();
        String description = item.path("description").asText("").trim();
        LocalDate date = parseDate(item.path("date").asText(null));

        if (category.isBlank()) {
            category = "Uncategorized";
        }

        return new TransactionRequest(amount.abs(), type, category, description, date);
    }

    private List<TransactionRequest> parseCsv(Reader reader) throws IOException {
        CSVParser parser = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreHeaderCase(true)
                .setTrim(true)
                .build()
                .parse(reader);

        List<TransactionRequest> requests = new ArrayList<>();
        for (CSVRecord record : parser) {
            String amountRaw = getFirst(record, "amount", "value", "sum");
            String dateRaw = getFirst(record, "date", "bookingDate", "transactionDate");

            if (amountRaw == null || dateRaw == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "CSV rows must contain at least amount and date columns"
                );
            }

            BigDecimal amount = parseAmount(amountRaw);
            TransactionType type = parseType(getFirst(record, "type", "transactionType"), amount);

            String category = Optional.ofNullable(getFirst(record, "category"))
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .orElse("Uncategorized");

            String description = Optional.ofNullable(getFirst(record, "description", "note", "details"))
                    .map(String::trim)
                    .orElse("");

            requests.add(new TransactionRequest(
                    amount.abs(),
                    type,
                    category,
                    description,
                    parseDate(dateRaw)
            ));
        }

        return requests;
    }

    private String getFirst(CSVRecord record, String... headers) {
        for (String expectedHeader : headers) {
            if (record.isMapped(expectedHeader)) {
                String value = record.get(expectedHeader);
                if (value != null && !value.isBlank()) {
                    return value;
                }
            }
        }

        Map<String, String> values = record.toMap();
        for (String expectedHeader : headers) {
            for (Map.Entry<String, String> entry : values.entrySet()) {
                if (entry.getKey() != null && entry.getKey().equalsIgnoreCase(expectedHeader)) {
                    String value = entry.getValue();
                    if (value != null && !value.isBlank()) {
                        return value;
                    }
                }
            }
        }

        return null;
    }

    private BigDecimal parseAmount(String rawAmount) {
        if (rawAmount == null || rawAmount.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transaction amount is required");
        }

        String normalized = rawAmount
                .trim()
                .replace("€", "")
                .replace("$", "")
                .replace(" ", "");

        if (normalized.contains(",") && !normalized.contains(".")) {
            normalized = normalized.replace(',', '.');
        } else {
            normalized = normalized.replace(",", "");
        }

        try {
            return new BigDecimal(normalized);
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid amount format: " + rawAmount);
        }
    }

    private TransactionType parseType(String rawType, BigDecimal amount) {
        if (rawType == null || rawType.isBlank()) {
            return amount.signum() < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
        }

        String normalized = rawType.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        return switch (normalized) {
            case "INCOME", "CREDIT", "DEPOSIT" -> TransactionType.INCOME;
            case "EXPENSE", "DEBIT", "WITHDRAWAL" -> TransactionType.EXPENSE;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown transaction type: " + rawType);
        };
    }

    private LocalDate parseDate(String rawDate) {
        if (rawDate == null || rawDate.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transaction date is required");
        }

        String normalized = rawDate.trim();
        for (DateTimeFormatter formatter : DATE_FORMATS) {
            try {
                return LocalDate.parse(normalized, formatter);
            } catch (DateTimeParseException ignored) {
                // Try next format
            }
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported date format: " + rawDate);
    }
}
