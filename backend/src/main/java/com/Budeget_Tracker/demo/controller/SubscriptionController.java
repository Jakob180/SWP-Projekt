package com.Budeget_Tracker.demo.controller;

import com.Budeget_Tracker.demo.dto.finance.SubscriptionRequest;
import com.Budeget_Tracker.demo.dto.finance.SubscriptionResponse;
import com.Budeget_Tracker.demo.security.CurrentUserProvider;
import com.Budeget_Tracker.demo.service.SubscriptionService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/subscriptions")
public class SubscriptionController {

    private final SubscriptionService subscriptionService;
    private final CurrentUserProvider currentUserProvider;

    public SubscriptionController(SubscriptionService subscriptionService, CurrentUserProvider currentUserProvider) {
        this.subscriptionService = subscriptionService;
        this.currentUserProvider = currentUserProvider;
    }

    @GetMapping
    public List<SubscriptionResponse> getSubscriptions() {
        Long userId = currentUserProvider.getCurrentUserId();
        return subscriptionService.findSubscriptions(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SubscriptionResponse createSubscription(@Valid @RequestBody SubscriptionRequest request) {
        Long userId = currentUserProvider.getCurrentUserId();
        return subscriptionService.createSubscription(userId, request);
    }

    @PutMapping("/{subscriptionId}")
    public SubscriptionResponse updateSubscription(
            @PathVariable Long subscriptionId,
            @Valid @RequestBody SubscriptionRequest request
    ) {
        Long userId = currentUserProvider.getCurrentUserId();
        return subscriptionService.updateSubscription(userId, subscriptionId, request);
    }

    @DeleteMapping("/{subscriptionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSubscription(@PathVariable Long subscriptionId) {
        Long userId = currentUserProvider.getCurrentUserId();
        subscriptionService.deleteSubscription(userId, subscriptionId);
    }
}
