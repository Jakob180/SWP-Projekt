package com.Budeget_Tracker.demo.dto.finance;

import java.math.BigDecimal;

public record AssetResponse(Long id, String name, BigDecimal value) {
}
