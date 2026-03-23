package com.Budeget_Tracker.demo.dto.finance;

import java.math.BigDecimal;

public record SubscriptionResponse(Long id, String name, BigDecimal monthlyCost) {
}
