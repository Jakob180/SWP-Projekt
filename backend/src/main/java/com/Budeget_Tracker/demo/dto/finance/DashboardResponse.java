package com.Budeget_Tracker.demo.dto.finance;

import java.math.BigDecimal;
import java.util.List;

public record DashboardResponse(
        BigDecimal totalBalance,
        BigDecimal totalIncome,
        BigDecimal totalExpenses,
        BigDecimal totalSubscriptions,
        BigDecimal totalAssets,
        List<BreakdownItem> expenseByCategory,
        List<BreakdownItem> assetsByName,
        List<MonthlyOverviewItem> monthlyOverview,
        List<YearlyOverviewItem> yearlyOverview,
        List<TransactionResponse> transactions,
        List<SubscriptionResponse> subscriptions,
        List<AssetResponse> assets
) {
}
