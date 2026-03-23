package com.Budeget_Tracker.demo.controller;

import com.Budeget_Tracker.demo.dto.finance.TransactionRequest;
import com.Budeget_Tracker.demo.dto.finance.TransactionResponse;
import com.Budeget_Tracker.demo.security.CurrentUserProvider;
import com.Budeget_Tracker.demo.service.TransactionService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionService transactionService;
    private final CurrentUserProvider currentUserProvider;

    public TransactionController(TransactionService transactionService, CurrentUserProvider currentUserProvider) {
        this.transactionService = transactionService;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    public List<TransactionResponse> getTransactions(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        Long userId = currentUserProvider.getCurrentUserId();
        return transactionService.findTransactions(userId, from, to);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TransactionResponse createTransaction(@Valid @RequestBody TransactionRequest request) {
        Long userId = currentUserProvider.getCurrentUserId();
        return transactionService.createTransaction(userId, request);
    }

    @PutMapping("/{transactionId}")
    public TransactionResponse updateTransaction(
            @PathVariable Long transactionId,
            @Valid @RequestBody TransactionRequest request
    ) {
        Long userId = currentUserProvider.getCurrentUserId();
        return transactionService.updateTransaction(userId, transactionId, request);
    }

    @DeleteMapping("/{transactionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTransaction(@PathVariable Long transactionId) {
        Long userId = currentUserProvider.getCurrentUserId();
        transactionService.deleteTransaction(userId, transactionId);
    }
}
