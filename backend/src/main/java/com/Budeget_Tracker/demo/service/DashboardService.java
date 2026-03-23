package com.Budeget_Tracker.demo.service;

import com.Budeget_Tracker.demo.dto.finance.AssetResponse;
import com.Budeget_Tracker.demo.dto.finance.BreakdownItem;
import com.Budeget_Tracker.demo.dto.finance.DashboardResponse;
import com.Budeget_Tracker.demo.dto.finance.MonthlyOverviewItem;
import com.Budeget_Tracker.demo.dto.finance.SubscriptionResponse;
import com.Budeget_Tracker.demo.dto.finance.TransactionResponse;
import com.Budeget_Tracker.demo.dto.finance.YearlyOverviewItem;
import com.Budeget_Tracker.demo.model.TransactionType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {

    private final TransactionService transactionService;
    private final SubscriptionService subscriptionService;
    private final AssetService assetService;

    public DashboardService(
            TransactionService transactionService,
            SubscriptionService subscriptionService,
            AssetService assetService
    ) {
        this.transactionService = transactionService;
        this.subscriptionService = subscriptionService;
        this.assetService = assetService;
    }

    public DashboardResponse getDashboard(Long userId, LocalDate from, LocalDate to) {
        List<TransactionResponse> transactions = transactionService.findTransactions(userId, from, to);
        List<SubscriptionResponse> subscriptions = subscriptionService.findSubscriptions(userId);
        List<AssetResponse> assets = assetService.findAssets(userId);

        BigDecimal totalIncome = transactions.stream()
                .filter(t -> t.type() == TransactionType.INCOME)
                .map(TransactionResponse::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalExpenses = transactions.stream()
                .filter(t -> t.type() == TransactionType.EXPENSE)
                .map(TransactionResponse::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalSubscriptions = subscriptions.stream()
                .map(SubscriptionResponse::monthlyCost)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalAssets = assets.stream()
                .map(AssetResponse::value)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalBalance = totalAssets.add(totalIncome).subtract(totalExpenses);

        List<BreakdownItem> expenseByCategory = transactions.stream()
                .filter(t -> t.type() == TransactionType.EXPENSE)
                .collect(java.util.stream.Collectors.groupingBy(
                        TransactionResponse::category,
                        java.util.stream.Collectors.mapping(
                                TransactionResponse::amount,
                                java.util.stream.Collectors.reducing(BigDecimal.ZERO, BigDecimal::add)
                        )
                ))
                .entrySet()
                .stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new BreakdownItem(entry.getKey(), entry.getValue()))
                .toList();

        List<BreakdownItem> assetsByName = assets.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        AssetResponse::name,
                        java.util.stream.Collectors.mapping(
                                AssetResponse::value,
                                java.util.stream.Collectors.reducing(BigDecimal.ZERO, BigDecimal::add)
                        )
                ))
                .entrySet()
                .stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new BreakdownItem(entry.getKey(), entry.getValue()))
                .toList();

        List<MonthlyOverviewItem> monthlyOverview = buildMonthlyOverview(transactions);
        List<YearlyOverviewItem> yearlyOverview = buildYearlyOverview(transactions);

        return new DashboardResponse(
                totalBalance,
                totalIncome,
                totalExpenses,
                totalSubscriptions,
                totalAssets,
                expenseByCategory,
                assetsByName,
                monthlyOverview,
                yearlyOverview,
                transactions,
                subscriptions,
                assets
        );
    }

    private List<MonthlyOverviewItem> buildMonthlyOverview(List<TransactionResponse> transactions) {
        Map<YearMonth, BigDecimal> incomeByMonth = new TreeMap<>();
        Map<YearMonth, BigDecimal> expenseByMonth = new TreeMap<>();

        for (TransactionResponse transaction : transactions) {
            YearMonth month = YearMonth.from(transaction.date());
            if (transaction.type() == TransactionType.INCOME) {
                incomeByMonth.merge(month, transaction.amount(), BigDecimal::add);
            } else {
                expenseByMonth.merge(month, transaction.amount(), BigDecimal::add);
            }
        }

        return java.util.stream.Stream.concat(incomeByMonth.keySet().stream(), expenseByMonth.keySet().stream())
                .distinct()
                .sorted()
                .map(month -> new MonthlyOverviewItem(
                        month.toString(),
                        incomeByMonth.getOrDefault(month, BigDecimal.ZERO),
                        expenseByMonth.getOrDefault(month, BigDecimal.ZERO)
                ))
                .toList();
    }

    private List<YearlyOverviewItem> buildYearlyOverview(List<TransactionResponse> transactions) {
        Map<Integer, BigDecimal> incomeByYear = new TreeMap<>();
        Map<Integer, BigDecimal> expenseByYear = new TreeMap<>();

        for (TransactionResponse transaction : transactions) {
            Integer year = transaction.date().getYear();
            if (transaction.type() == TransactionType.INCOME) {
                incomeByYear.merge(year, transaction.amount(), BigDecimal::add);
            } else {
                expenseByYear.merge(year, transaction.amount(), BigDecimal::add);
            }
        }

        return java.util.stream.Stream.concat(incomeByYear.keySet().stream(), expenseByYear.keySet().stream())
                .distinct()
                .sorted(Comparator.naturalOrder())
                .map(year -> new YearlyOverviewItem(
                        year,
                        incomeByYear.getOrDefault(year, BigDecimal.ZERO),
                        expenseByYear.getOrDefault(year, BigDecimal.ZERO)
                ))
                .toList();
    }
}
