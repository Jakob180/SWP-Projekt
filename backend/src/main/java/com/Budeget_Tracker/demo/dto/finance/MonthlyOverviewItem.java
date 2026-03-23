package com.Budeget_Tracker.demo.dto.finance;

import java.math.BigDecimal;

public record MonthlyOverviewItem(String month, BigDecimal income, BigDecimal expense) {
}
