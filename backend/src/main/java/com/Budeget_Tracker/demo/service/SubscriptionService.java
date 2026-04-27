package com.Budeget_Tracker.demo.service;

import com.Budeget_Tracker.demo.dto.finance.SubscriptionRequest;
import com.Budeget_Tracker.demo.dto.finance.SubscriptionResponse;
import com.Budeget_Tracker.demo.model.Subscription;
import com.Budeget_Tracker.demo.repository.SubscriptionRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;

    public SubscriptionService(SubscriptionRepository subscriptionRepository) {
        this.subscriptionRepository = subscriptionRepository;
    }

    public List<SubscriptionResponse> findSubscriptions(Long userId) {
        return subscriptionRepository.findByUserIdOrderByNameAsc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public SubscriptionResponse createSubscription(Long userId, SubscriptionRequest request) {
        Subscription subscription = new Subscription();
        subscription.setUserId(userId);
        applyRequestToEntity(subscription, request);
        return toResponse(subscriptionRepository.save(subscription));
    }

    public SubscriptionResponse updateSubscription(Long userId, Long subscriptionId, SubscriptionRequest request) {
        Subscription subscription = subscriptionRepository.findByIdAndUserId(subscriptionId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Subscription not found"));

        applyRequestToEntity(subscription, request);
        return toResponse(subscriptionRepository.save(subscription));
    }

    public void deleteSubscription(Long userId, Long subscriptionId) {
        Subscription subscription = subscriptionRepository.findByIdAndUserId(subscriptionId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Subscription not found"));

        subscriptionRepository.delete(subscription);
    }

    public void deleteAllSubscriptions(Long userId) {
        subscriptionRepository.deleteByUserId(userId);
    }

    private void applyRequestToEntity(Subscription entity, SubscriptionRequest request) {
        entity.setName(request.name().trim());
        entity.setMonthlyCost(request.monthlyCost());
    }

    private SubscriptionResponse toResponse(Subscription subscription) {
        return new SubscriptionResponse(
                subscription.getId(),
                subscription.getName(),
                subscription.getMonthlyCost()
        );
    }
}
