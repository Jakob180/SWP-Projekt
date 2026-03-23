package com.Budeget_Tracker.demo.service;

import com.Budeget_Tracker.demo.dto.finance.TransactionRequest;
import com.Budeget_Tracker.demo.dto.finance.TransactionResponse;
import com.Budeget_Tracker.demo.model.FinanceTransaction;
import com.Budeget_Tracker.demo.repository.FinanceTransactionRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TransactionService {

    private static final LocalDate EARLIEST_DATE = LocalDate.of(1900, 1, 1);
    private static final LocalDate LATEST_DATE = LocalDate.of(3000, 1, 1);

    private final FinanceTransactionRepository transactionRepository;

    public TransactionService(FinanceTransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    public List<TransactionResponse> findTransactions(Long userId, LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date range: from must be before to");
        }

        List<FinanceTransaction> transactions;
        if (from == null && to == null) {
            transactions = transactionRepository.findByUserIdOrderByDateDesc(userId);
        } else {
            LocalDate lowerBound = from != null ? from : EARLIEST_DATE;
            LocalDate upperBound = to != null ? to : LATEST_DATE;
            transactions = transactionRepository
                    .findByUserIdAndDateGreaterThanEqualAndDateLessThanEqualOrderByDateDesc(userId, lowerBound, upperBound);
        }

        return transactions.stream().map(this::toResponse).toList();
    }

    public TransactionResponse createTransaction(Long userId, TransactionRequest request) {
        FinanceTransaction transaction = new FinanceTransaction();
        transaction.setUserId(userId);
        applyRequestToEntity(transaction, request);
        return toResponse(transactionRepository.save(transaction));
    }

    public TransactionResponse updateTransaction(Long userId, Long transactionId, TransactionRequest request) {
        FinanceTransaction transaction = transactionRepository.findByIdAndUserId(transactionId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction not found"));

        applyRequestToEntity(transaction, request);
        return toResponse(transactionRepository.save(transaction));
    }

    public void deleteTransaction(Long userId, Long transactionId) {
        FinanceTransaction transaction = transactionRepository.findByIdAndUserId(transactionId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction not found"));
        transactionRepository.delete(transaction);
    }

    public int importTransactions(Long userId, List<TransactionRequest> requests) {
        List<FinanceTransaction> entities = requests.stream().map(request -> {
            FinanceTransaction transaction = new FinanceTransaction();
            transaction.setUserId(userId);
            applyRequestToEntity(transaction, request);
            return transaction;
        }).toList();

        transactionRepository.saveAll(entities);
        return entities.size();
    }

    private void applyRequestToEntity(FinanceTransaction entity, TransactionRequest request) {
        entity.setAmount(request.amount().abs());
        entity.setType(request.type());
        entity.setCategory(request.category().trim());
        entity.setDescription(request.description() == null ? "" : request.description().trim());
        entity.setDate(request.date());
    }

    private TransactionResponse toResponse(FinanceTransaction transaction) {
        return new TransactionResponse(
                transaction.getId(),
                transaction.getAmount(),
                transaction.getType(),
                transaction.getCategory(),
                transaction.getDescription(),
                transaction.getDate()
        );
    }
}
