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
import java.io.StringReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class FileImportService {

    private static final Set<String> AMOUNT_HEADERS = Set.of("amount", "value", "sum", "betrag", "umsatz");
    private static final Set<String> DATE_HEADERS = Set.of("date", "bookingdate", "transactiondate", "valuedate", "datum");
    private static final Set<String> TYPE_HEADERS = Set.of("type", "transactiontype", "buchungstyp");
    private static final Set<String> CATEGORY_HEADERS = Set.of("category", "kategorie");
    private static final Set<String> DESCRIPTION_HEADERS = Set.of("description", "note", "details", "text", "verwendungszweck");

    private static final int ELBA_BOOKING_DATE_INDEX = 0;
    private static final int ELBA_DESCRIPTION_INDEX = 1;
    private static final int ELBA_VALUE_DATE_INDEX = 2;
    private static final int ELBA_AMOUNT_INDEX = 3;
    private static final Pattern PURPOSE_PATTERN = Pattern.compile(
            "(?i)verwendungszweck:\\s*(.*?)(?:\\s+weiterer\\s+verwendungszweck:|\\s+belegref:|$)"
    );

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
        try {
            int importedCount = transactionService.importTransactions(userId, transactions);
            LocalDate importedFrom = transactions.stream()
                    .map(TransactionRequest::date)
                    .min(Comparator.naturalOrder())
                    .orElse(null);
            LocalDate importedTo = transactions.stream()
                    .map(TransactionRequest::date)
                    .max(Comparator.naturalOrder())
                    .orElse(null);
            return new FileImportResponse(importedCount, importedFrom, importedTo);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Import could not be saved. Please check transaction values and the database schema.",
                    ex
            );
        }
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
        String category = sanitizeCategory(item.path("category").asText("Uncategorized"));
        String description = sanitizeDescription(item.path("description").asText(""));
        LocalDate date = parseDate(item.path("date").asText(null));

        return new TransactionRequest(amount.abs(), type, category, description, date);
    }

    private List<TransactionRequest> parseCsv(Reader reader) throws IOException {
        String csvContent = stripBom(readAll(reader));
        if (csvContent.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file is empty");
        }

        char delimiter = detectDelimiter(csvContent);
        CSVFormat rawFormat = CSVFormat.DEFAULT.builder()
                .setDelimiter(delimiter)
                .setTrim(true)
                .build();

        List<CSVRecord> records;
        try (CSVParser parser = rawFormat.parse(new StringReader(csvContent))) {
            records = parser.getRecords();
        }

        if (records.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file does not contain any rows");
        }

        if (looksLikeHeaderRow(records.get(0))) {
            return parseCsvWithHeaders(csvContent, delimiter);
        }

        return parseCsvWithoutHeaders(records);
    }

    private List<TransactionRequest> parseCsvWithHeaders(String csvContent, char delimiter) throws IOException {
        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setDelimiter(delimiter)
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreHeaderCase(true)
                .setTrim(true)
                .build();

        List<TransactionRequest> requests = new ArrayList<>();
        try (CSVParser parser = format.parse(new StringReader(csvContent))) {
            for (CSVRecord record : parser) {
                if (isRowEmpty(record)) {
                    continue;
                }

                requests.add(parseCsvRecordWithHeaders(record));
            }
        }

        if (requests.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file does not contain importable transactions");
        }

        return requests;
    }

    private TransactionRequest parseCsvRecordWithHeaders(CSVRecord record) {
        String amountRaw = getFirst(record, "amount", "value", "sum", "betrag", "umsatz");
        String dateRaw = getFirst(record, "date", "bookingDate", "transactionDate", "valueDate", "datum");
        String rawDescription = getFirst(record, "description", "note", "details", "text", "verwendungszweck");

        if ((amountRaw == null || dateRaw == null) && looksLikeElbaRow(record)) {
            return parseElbaRecord(record);
        }

        if (amountRaw == null || dateRaw == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "CSV rows must contain amount and date (header names like amount/date or meinElba format)"
            );
        }

        BigDecimal amount = parseAmount(amountRaw);
        TransactionType type = parseType(getFirst(record, "type", "transactionType", "buchungstyp"), amount);
        String description = sanitizeDescription(rawDescription);

        String category = Optional.ofNullable(getFirst(record, "category", "kategorie"))
                .map(this::sanitizeCategory)
                .orElseGet(() -> inferCategory(description, type));

        return new TransactionRequest(
                amount.abs(),
                type,
                category,
                description,
                parseDate(dateRaw)
        );
    }

    private List<TransactionRequest> parseCsvWithoutHeaders(List<CSVRecord> records) {
        List<TransactionRequest> requests = new ArrayList<>();
        for (CSVRecord record : records) {
            if (isRowEmpty(record)) {
                continue;
            }

            requests.add(parseElbaRecord(record));
        }

        if (requests.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file does not contain importable transactions");
        }

        return requests;
    }

    private TransactionRequest parseElbaRecord(CSVRecord record) {
        if (record.size() <= ELBA_AMOUNT_INDEX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV row has too few columns for import");
        }

        String amountRaw = record.get(ELBA_AMOUNT_INDEX);
        String dateRaw = firstNonBlank(record, ELBA_BOOKING_DATE_INDEX, ELBA_VALUE_DATE_INDEX);
        if (dateRaw == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Transaction date is required");
        }

        BigDecimal amount = parseAmount(amountRaw);
        TransactionType type = parseType(null, amount);

        String description = sanitizeDescription(getValue(record, ELBA_DESCRIPTION_INDEX));
        String category = inferCategory(description, type);

        return new TransactionRequest(
                amount.abs(),
                type,
                category,
                description,
                parseDate(dateRaw)
        );
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

    private boolean looksLikeHeaderRow(CSVRecord firstRow) {
        for (String value : firstRow) {
            String normalized = normalizeHeader(value);
            if (AMOUNT_HEADERS.contains(normalized)
                    || DATE_HEADERS.contains(normalized)
                    || TYPE_HEADERS.contains(normalized)
                    || CATEGORY_HEADERS.contains(normalized)
                    || DESCRIPTION_HEADERS.contains(normalized)) {
                return true;
            }
        }

        return false;
    }

    private boolean looksLikeElbaRow(CSVRecord record) {
        if (record.size() <= ELBA_AMOUNT_INDEX) {
            return false;
        }

        String amountRaw = getValue(record, ELBA_AMOUNT_INDEX);
        String dateRaw = firstNonBlank(record, ELBA_BOOKING_DATE_INDEX, ELBA_VALUE_DATE_INDEX);

        try {
            parseAmount(amountRaw);
            parseDate(dateRaw);
            return true;
        } catch (ResponseStatusException ignored) {
            return false;
        }
    }

    private boolean isRowEmpty(CSVRecord record) {
        for (String value : record) {
            if (value != null && !value.trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }

    private String readAll(Reader reader) throws IOException {
        StringBuilder builder = new StringBuilder();
        char[] buffer = new char[4096];
        int read;
        while ((read = reader.read(buffer)) != -1) {
            builder.append(buffer, 0, read);
        }
        return builder.toString();
    }

    private String stripBom(String input) {
        if (input != null && input.startsWith("\uFEFF")) {
            return input.substring(1);
        }
        return input == null ? "" : input;
    }

    private char detectDelimiter(String csvContent) {
        String firstLine = csvContent.lines()
                .map(String::trim)
                .filter(line -> !line.isEmpty())
                .findFirst()
                .orElse("");

        long semicolons = firstLine.chars().filter(character -> character == ';').count();
        long commas = firstLine.chars().filter(character -> character == ',').count();
        return semicolons > commas ? ';' : ',';
    }

    private String normalizeHeader(String headerValue) {
        if (headerValue == null) {
            return "";
        }

        return headerValue
                .replace("\uFEFF", "")
                .trim()
                .toLowerCase(Locale.ROOT)
                .replace(" ", "")
                .replace("_", "")
                .replace("-", "");
    }

    private String getValue(CSVRecord record, int index) {
        if (index < 0 || index >= record.size()) {
            return null;
        }
        return record.get(index);
    }

    private String firstNonBlank(CSVRecord record, int... indexes) {
        for (int index : indexes) {
            String value = getValue(record, index);
            if (value != null && !value.trim().isEmpty()) {
                return value;
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

    private String inferCategory(String description, TransactionType type) {
        String purpose = extractPurpose(description);
        if (!purpose.isBlank()) {
            return sanitizeCategory(purpose);
        }

        String normalized = normalizeForMatching(description);

        if (type == TransactionType.INCOME) {
            if (containsAny(normalized, "GEHALT", "LOHN", "SALARY")) {
                return "Gehalt";
            }
            if (containsAny(normalized, "HONORAR", "FREELANCE", "SELBSTSTAENDIG", "SELBSTANDIG")) {
                return "Selbststaendige Arbeit";
            }
            if (containsAny(normalized, "ZINS", "INTEREST")) {
                return "Zinsen";
            }
            if (containsAny(normalized, "BONUS", "PRAMIE", "PRAEMIE")) {
                return "Bonus";
            }
            if (containsAny(normalized, "RUECKERSTATTUNG", "RUCKERSTATTUNG", "REFUND", "RETURE", "RETOUR")) {
                return "Rueckerstattung";
            }
            if (containsAny(normalized, "BEIHILFE", "KINDERGELD", "FAMILIENBEIHILFE", "FOERDERUNG", "FORDERUNG")) {
                return "Beihilfe";
            }
            if (containsAny(normalized, "UEBERWEISUNG", "UBERWEISUNG", "SCT", "SEPA", "GUTSCHRIFT")) {
                return "Ueberweisung Eingang";
            }
            return "Sonstige Einnahmen";
        }

        if (containsAny(normalized, "MIETE", "RENT")) {
            return "Miete";
        }
        if (containsAny(normalized, "SPAR", "BILLA", "HOFER", "LIDL", "PENNY", "DM", "MPRICE", "M-PREIS", "MPREIS")) {
            return "Lebensmittel";
        }
        if (containsAny(normalized, "RESTAURANT", "CAFE", "PIZZA", "MCDONALD", "BURGER", "LIEFERANDO", "DOENER", "KEBAB")) {
            return "Essen gehen";
        }
        if (containsAny(normalized, "AMAZON", "ZALANDO", "H&M", "HM", "IKEA")) {
            return "Shopping";
        }
        if (containsAny(normalized, "SHELL", "OMV", "BP", "JET", "TANK", "TANKSTELLE")) {
            return "Tanken";
        }
        if (containsAny(normalized, "OEBB", "WLINIE", "WIENER LINIEN", "UBER", "BOLT", "TAXI", "PARKEN")) {
            return "Transport";
        }
        if (containsAny(normalized, "STROM", "GAS", "ENERGIE", "WASSER", "INTERNET", "A1", "MAGENTA", "DREI")) {
            return "Fixkosten";
        }
        if (containsAny(normalized, "VERSICHERUNG", "ALLIANZ", "UNIQA", "DONAU")) {
            return "Versicherung";
        }
        if (containsAny(normalized, "ARZT", "APOTHEKE", "MEDIK", "KRANKEN")) {
            return "Gesundheit";
        }
        if (containsAny(normalized, "NETFLIX", "SPOTIFY", "DISNEY", "STEAM", "PLAYSTATION", "XBOX")) {
            return "Freizeit";
        }
        if (containsAny(normalized, "BAR", "BANKOMAT", "ATM", "BARGELD")) {
            return "Barbehebung";
        }
        if (containsAny(normalized, "POS", "KARTENZAHLUNG", "CARD")) {
            return "Kartenzahlung";
        }
        if (containsAny(normalized, "LASTSCHRIFT", "DIRECT DEBIT")) {
            return "Lastschrift";
        }
        if (containsAny(normalized, "UEBERWEISUNG", "UBERWEISUNG", "SCT", "SEPA", "TRANSFER")) {
            return "Ueberweisung Ausgang";
        }

        return "Sonstige Ausgaben";
    }

    private String extractPurpose(String description) {
        if (description == null || description.isBlank()) {
            return "";
        }

        Matcher matcher = PURPOSE_PATTERN.matcher(description);
        if (!matcher.find()) {
            return "";
        }

        String purpose = matcher.group(1);
        if (purpose == null) {
            return "";
        }

        return purpose.trim().replaceAll("\\s+", " ");
    }

    private String normalizeForMatching(String text) {
        if (text == null) {
            return "";
        }

        return text.toUpperCase(Locale.ROOT)
                .replace('Ä', 'A')
                .replace('Ö', 'O')
                .replace('Ü', 'U')
                .replace("ß", "SS");
    }

    private boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String sanitizeCategory(String rawCategory) {
        String fallback = "Uncategorized";
        if (rawCategory == null) {
            return fallback;
        }

        String normalized = rawCategory.trim();
        if (normalized.isBlank()) {
            return fallback;
        }

        if (normalized.length() > 80) {
            return normalized.substring(0, 80);
        }

        return normalized;
    }

    private String sanitizeDescription(String rawDescription) {
        if (rawDescription == null) {
            return "";
        }

        String normalized = rawDescription.trim().replaceAll("\\s+", " ");
        if (normalized.length() > 255) {
            return normalized.substring(0, 255);
        }

        return normalized;
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
