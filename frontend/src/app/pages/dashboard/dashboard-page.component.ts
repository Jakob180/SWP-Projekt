import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription as RxSubscription, interval } from 'rxjs';
import { ChartPanelComponent } from '../../components/chart-panel/chart-panel.component';
import { Asset, DashboardResponse, Subscription, Transaction, TransactionType } from '../../models/api.models';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

type DashboardView = 'overview' | 'income' | 'expense' | 'period';
type BudgetState = 'ok' | 'warn' | 'over';

interface SidebarNavItem {
  id: DashboardView;
  label: string;
  shortLabel: string;
  icon: string;
}

interface BudgetStatus {
  category: string;
  budget: number;
  spent: number;
  remaining: number;
  usagePercent: number;
  usagePercentCapped: number;
  state: BudgetState;
}

interface PendingBudgetConfirmation {
  category: string;
  budget: number;
  spent: number;
  overdraw: number;
}

interface CategoryOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ChartPanelComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css'
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  private static readonly MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  private static readonly THEME_STORAGE_KEY = 'finance_dashboard_theme';
  private static readonly BUDGET_STORAGE_KEY = 'finance_dashboard_budgets';
  private static readonly AUTO_REFRESH_MS = 15000;

  private autoRefreshSubscription?: RxSubscription;
  private dashboardLoadSubscription?: RxSubscription;

  dashboard?: DashboardResponse;
  loading = true;
  errorMessage = '';
  actionMessage = '';
  actionError = '';
  actionLoading = false;

  filterMode: 'month' | 'year' | 'custom' | 'all' = 'month';
  customFrom = '';
  customTo = '';

  activeFrom = '';
  activeTo = '';

  transactionAmount: number | null = null;
  transactionType: TransactionType = 'EXPENSE';
  transactionCategory = '';
  transactionDescription = '';
  transactionDate = this.todayDateString();

  subscriptionName = '';
  subscriptionMonthlyCost: number | null = null;

  assetName = '';
  assetValue: number | null = null;
  budgetCategory = '';
  budgetAmount: number | null = null;
  budgetMessage = '';
  budgetError = '';
  budgetStatuses: BudgetStatus[] = [];
  pendingBudgetConfirmation: PendingBudgetConfirmation | null = null;
  private readonly budgets = new Map<string, number>();

  sidebarCollapsed = false;
  darkMode = false;
  activeView: DashboardView = 'overview';
  trendGranularity: 'week' | 'month' | 'year' = 'month';

  expenseCategoryLabels: string[] = [];
  expenseCategoryData: number[] = [];
  incomeCategoryLabels: string[] = [];
  incomeCategoryData: number[] = [];
  assetChartLabels: string[] = [];
  assetChartData: number[] = [];

  trendLabels: string[] = [];
  trendIncomeData: number[] = [];
  trendExpenseData: number[] = [];
  trendNetData: number[] = [];

  readonly palette = ['#0ea5e9', '#06b6d4', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
  readonly incomePalette = ['#22c55e', '#16a34a', '#84cc16', '#2dd4bf', '#38bdf8', '#4ade80'];
  readonly expensePalette = ['#ef4444', '#f97316', '#f59e0b', '#e11d48', '#fb7185', '#dc2626'];
  readonly incomeCategories: CategoryOption[] = [
    { value: 'Gehalt', label: 'Gehalt' },
    { value: 'Freelance', label: 'Freelance' },
    { value: 'Bonus', label: 'Bonus' },
    { value: 'Verkauf', label: 'Verkauf' },
    { value: 'Rueckerstattung', label: 'Rueckerstattung' },
    { value: 'Investition', label: 'Investition' },
    { value: 'Sonstige Einnahmen', label: 'Sonstige Einnahmen' }
  ];
  readonly expenseCategories: CategoryOption[] = [
    { value: 'Lebensmittel', label: 'Lebensmittel' },
    { value: 'Miete', label: 'Miete' },
    { value: 'Transport', label: 'Transport' },
    { value: 'Shopping', label: 'Shopping' },
    { value: 'Freizeit', label: 'Freizeit' },
    { value: 'Gesundheit', label: 'Gesundheit' },
    { value: 'Fixkosten', label: 'Fixkosten' },
    { value: 'Versicherung', label: 'Versicherung' },
    { value: 'Sonstige Ausgaben', label: 'Sonstige Ausgaben' }
  ];
  readonly sidebarNavItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Uebersicht', shortLabel: 'Ue', icon: '◎' },
    { id: 'income', label: 'Einnahmen', shortLabel: 'Ein', icon: '↗' },
    { id: 'expense', label: 'Ausgaben', shortLabel: 'Aus', icon: '↘' },
    { id: 'period', label: 'Zeitraum', shortLabel: 'Zeit', icon: '◴' }
  ];

  constructor(
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initializeSidebar();
    this.initializeTheme();
    this.initializeBudgets();
    this.ensureValidTransactionCategory();
    this.applyInitialRange();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.autoRefreshSubscription?.unsubscribe();
    this.dashboardLoadSubscription?.unsubscribe();
  }

  get username(): string {
    return this.authService.getUsername();
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  get currentViewTitle(): string {
    switch (this.activeView) {
      case 'income':
        return 'Einnahmen';
      case 'expense':
        return 'Ausgaben';
      case 'period':
        return 'Zeitraumanalyse';
      default:
        return 'Dashboard';
    }
  }

  get currentViewSubtitle(): string {
    if (this.filterMode === 'all' || (!this.activeFrom && !this.activeTo)) {
      if (this.activeView === 'period') {
        return `Vergleich auf ${this.trendGranularityLabel}-Basis ueber die Gesamtzeit`;
      }

      if (this.activeView === 'income') {
        return 'Einnahmen ueber die Gesamtzeit';
      }

      if (this.activeView === 'expense') {
        return 'Ausgaben ueber die Gesamtzeit';
      }

      return 'Uebersicht ueber die Gesamtzeit';
    }

    const fromLabel = this.formatDateLabel(this.activeFrom);
    const toLabel = this.formatDateLabel(this.activeTo);

    if (this.activeView === 'period') {
      return `Vergleich auf ${this.trendGranularityLabel}-Basis vom ${fromLabel} bis ${toLabel}`;
    }

    if (this.activeView === 'income') {
      return `Einnahmen vom ${fromLabel} bis ${toLabel}`;
    }

    if (this.activeView === 'expense') {
      return `Ausgaben vom ${fromLabel} bis ${toLabel}`;
    }

    return `Uebersicht vom ${fromLabel} bis ${toLabel}`;
  }

  get showOverviewSections(): boolean {
    return this.activeView === 'overview';
  }

  get showIncomeSections(): boolean {
    return this.activeView === 'overview' || this.activeView === 'income';
  }

  get showExpenseSections(): boolean {
    return this.activeView === 'overview' || this.activeView === 'expense';
  }

  get showAssetSections(): boolean {
    return this.activeView === 'overview';
  }

  get showPeriodSections(): boolean {
    return this.activeView === 'overview' || this.activeView === 'period';
  }

  get filteredTransactions(): Transaction[] {
    const transactions = this.dashboard?.transactions ?? [];

    if (this.activeView === 'income') {
      return transactions.filter((transaction) => transaction.type === 'INCOME');
    }

    if (this.activeView === 'expense') {
      return transactions.filter((transaction) => transaction.type === 'EXPENSE');
    }

    return transactions;
  }

  get transactionsTitle(): string {
    if (this.activeView === 'income') {
      return 'Einnahmen';
    }

    if (this.activeView === 'expense') {
      return 'Ausgaben';
    }

    return 'Transaktionen';
  }

  get emptyTransactionsMessage(): string {
    if (this.activeView === 'income') {
      return 'Keine Einnahmen in diesem Zeitraum.';
    }

    if (this.activeView === 'expense') {
      return 'Keine Ausgaben in diesem Zeitraum.';
    }

    return 'Keine Transaktionen in diesem Zeitraum.';
  }

  get trendGranularityLabel(): string {
    return this.trendGranularity === 'week'
      ? 'Woche'
      : this.trendGranularity === 'month'
        ? 'Monat'
        : 'Jahr';
  }

  get transactionCardTitle(): string {
    return this.transactionType === 'INCOME' ? 'Neue Einnahme' : 'Neue Ausgabe';
  }

  get transactionAmountLabel(): string {
    return this.transactionType === 'INCOME' ? 'Einnahmebetrag' : 'Ausgabebetrag';
  }

  get transactionButtonLabel(): string {
    return this.transactionType === 'INCOME' ? 'Einnahme speichern' : 'Ausgabe speichern';
  }

  get showTransactionTypeSwitch(): boolean {
    return this.activeView === 'overview';
  }

  get transactionCategoryOptions(): CategoryOption[] {
    return this.transactionType === 'INCOME' ? this.incomeCategories : this.expenseCategories;
  }

  setView(view: DashboardView): void {
    this.activeView = view;

    if (view === 'income') {
      this.transactionType = 'INCOME';
      this.ensureValidTransactionCategory();
    } else if (view === 'expense') {
      this.transactionType = 'EXPENSE';
      this.ensureValidTransactionCategory();
    }
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    this.applyTheme();
  }

  getTransactionTypeLabel(type: TransactionType): string {
    return type === 'INCOME' ? 'Einnahme' : 'Ausgabe';
  }

  setTransactionType(type: TransactionType): void {
    this.transactionType = type;
    this.ensureValidTransactionCategory();
  }

  applyPreset(mode: 'month' | 'year' | 'all'): void {
    this.filterMode = mode;

    if (mode === 'all') {
      this.customFrom = '';
      this.customTo = '';
      this.loadDashboard();
      return;
    }

    const today = new Date();

    if (mode === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      this.customFrom = this.toDateInput(start);
      this.customTo = this.toDateInput(today);
    } else {
      const start = new Date(today.getFullYear(), 0, 1);
      this.customFrom = this.toDateInput(start);
      this.customTo = this.toDateInput(today);
    }

    this.loadDashboard(this.customFrom, this.customTo);
  }

  applyCustomRange(): void {
    this.filterMode = 'custom';
    if (!this.customFrom || !this.customTo) {
      this.errorMessage = 'Bitte gib sowohl ein Start- als auch ein Enddatum an.';
      return;
    }

    this.loadDashboard(this.customFrom, this.customTo);
  }

  setTrendGranularity(granularity: 'week' | 'month' | 'year'): void {
    this.trendGranularity = granularity;
    this.buildTrendSeries(this.dashboard?.transactions ?? []);
  }

  addTransaction(): void {
    if (!this.transactionAmount || this.transactionAmount <= 0 || !this.transactionCategory.trim() || !this.transactionDate) {
      this.actionError = 'Bitte Betrag, Kategorie und Datum fuer die Transaktion ausfuellen.';
      this.actionMessage = '';
      return;
    }

    this.actionLoading = true;
    this.actionError = '';
    this.actionMessage = '';

    this.apiService.createTransaction({
      amount: this.transactionAmount,
      type: this.transactionType,
      category: this.transactionCategory.trim(),
      description: this.transactionDescription.trim(),
      date: this.transactionDate
    }).subscribe({
      next: (createdTransaction) => {
        const savedType = createdTransaction.type;
        this.applyTransactionLocally(createdTransaction);

        this.transactionAmount = null;
        this.transactionCategory = this.getDefaultCategoryForType(savedType);
        this.transactionDescription = '';
        if (this.activeView === 'income') {
          this.transactionType = 'INCOME';
        } else if (this.activeView === 'expense') {
          this.transactionType = 'EXPENSE';
        }
        this.transactionDate = this.todayDateString();
        this.actionMessage = savedType === 'INCOME'
          ? 'Einnahme gespeichert.'
          : 'Ausgabe gespeichert.';
        this.actionLoading = false;
        this.refreshDashboardAfterMutation(createdTransaction.date);
      },
      error: (error) => {
        this.actionLoading = false;
        this.actionError = error?.error?.message ?? 'Transaktion konnte nicht gespeichert werden.';
      }
    });
  }

  addSubscription(): void {
    if (!this.subscriptionName.trim() || !this.subscriptionMonthlyCost || this.subscriptionMonthlyCost <= 0) {
      this.actionError = 'Bitte Name und monatliche Kosten fuer das Abo angeben.';
      this.actionMessage = '';
      return;
    }

    this.actionLoading = true;
    this.actionError = '';
    this.actionMessage = '';

    this.apiService.createSubscription({
      name: this.subscriptionName.trim(),
      monthlyCost: this.subscriptionMonthlyCost
    }).subscribe({
      next: (createdSubscription) => {
        this.applySubscriptionLocally(createdSubscription);
        this.subscriptionName = '';
        this.subscriptionMonthlyCost = null;
        this.actionMessage = 'Abo gespeichert.';
        this.actionLoading = false;
        this.refreshDashboardAfterMutation();
      },
      error: (error) => {
        this.actionLoading = false;
        this.actionError = error?.error?.message ?? 'Abo konnte nicht gespeichert werden.';
      }
    });
  }

  addAsset(): void {
    if (!this.assetName.trim() || this.assetValue == null || this.assetValue < 0) {
      this.actionError = 'Bitte Name und Wert fuer das Asset angeben.';
      this.actionMessage = '';
      return;
    }

    this.actionLoading = true;
    this.actionError = '';
    this.actionMessage = '';

    this.apiService.createAsset({
      name: this.assetName.trim(),
      value: this.assetValue
    }).subscribe({
      next: (createdAsset) => {
        this.applyAssetLocally(createdAsset);
        this.assetName = '';
        this.assetValue = null;
        this.actionMessage = 'Asset gespeichert.';
        this.actionLoading = false;
        this.refreshDashboardAfterMutation();
      },
      error: (error) => {
        this.actionLoading = false;
        this.actionError = error?.error?.message ?? 'Asset konnte nicht gespeichert werden.';
      }
    });
  }

  deleteAllData(): void {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('Wirklich alle Transaktionen, Abos und Assets loeschen?');
      if (!confirmed) {
        return;
      }
    }

    this.actionLoading = true;
    this.actionError = '';
    this.actionMessage = '';

    this.apiService.deleteAllData().subscribe({
      next: () => {
        if (this.dashboard) {
          this.dashboard.transactions = [];
          this.dashboard.subscriptions = [];
          this.dashboard.assets = [];
          this.dashboard.totalIncome = 0;
          this.dashboard.totalExpenses = 0;
          this.dashboard.totalSubscriptions = 0;
          this.dashboard.totalAssets = 0;
          this.dashboard.totalBalance = 0;
        }

        this.budgets.clear();
        this.persistBudgets();
        this.rebuildVisualSeries();
        this.rebuildBudgetStatuses();
        this.actionLoading = false;
        this.actionMessage = 'Alle Daten wurden geloescht.';
      },
      error: (error) => {
        this.actionLoading = false;
        this.actionError = error?.error?.message ?? 'Alle Daten konnten nicht geloescht werden.';
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  private applyInitialRange(): void {
    const queryParams = this.route.snapshot.queryParamMap;
    const from = queryParams.get('from');
    const to = queryParams.get('to');
    const imported = queryParams.get('imported');

    if (from && to) {
      this.filterMode = 'custom';
      this.customFrom = from;
      this.customTo = to;
      this.loadDashboard(from, to);
    } else {
      this.applyPreset('month');
    }

    if (imported === 'true') {
      this.actionMessage = 'Import abgeschlossen. Die importierten Transaktionen werden jetzt im passenden Zeitraum angezeigt.';
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { imported: null, from, to },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-AT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2
    }).format(value ?? 0);
  }

  private loadDashboard(from?: string, to?: string): void {
    this.dashboardLoadSubscription?.unsubscribe();
    this.loading = true;
    this.errorMessage = '';
    this.activeFrom = from ?? '';
    this.activeTo = to ?? '';

    this.dashboardLoadSubscription = this.apiService.getDashboard({ from, to }).subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.rebuildVisualSeries();
        this.rebuildBudgetStatuses();
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.error?.message ?? 'Dashboard-Daten konnten nicht geladen werden.';
      }
    });
  }

  private startAutoRefresh(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.autoRefreshSubscription?.unsubscribe();
    this.autoRefreshSubscription = interval(DashboardPageComponent.AUTO_REFRESH_MS).subscribe(() => {
      if (this.loading || this.actionLoading || document.hidden) {
        return;
      }

      this.reloadCurrentFilter();
    });
  }

  private reloadCurrentFilter(): void {
    if (this.filterMode === 'all') {
      this.loadDashboard();
      return;
    }

    const from = this.activeFrom || this.customFrom;
    const to = this.activeTo || this.customTo;
    this.loadDashboard(from || undefined, to || undefined);
  }

  private ensureValidTransactionCategory(): void {
    const options = this.transactionCategoryOptions;
    if (!options.some((option) => option.value === this.transactionCategory)) {
      this.transactionCategory = options[0]?.value ?? '';
    }
  }

  private getDefaultCategoryForType(type: TransactionType): string {
    return type === 'INCOME'
      ? (this.incomeCategories[0]?.value ?? '')
      : (this.expenseCategories[0]?.value ?? '');
  }

  private toDateInput(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private todayDateString(): string {
    return this.toDateInput(new Date());
  }

  private formatDateLabel(dateRaw: string): string {
    if (!dateRaw) {
      return '-';
    }

    const date = new Date(`${dateRaw}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      return dateRaw;
    }

    return new Intl.DateTimeFormat('de-AT').format(date);
  }

  private rebuildVisualSeries(): void {
    const transactions = this.dashboard?.transactions ?? [];
    this.buildCategorySeries(transactions);
    this.buildAssetSeries();
    this.buildTrendSeries(transactions);
  }

  private buildCategorySeries(transactions: Transaction[]): void {
    const expenseMap = new Map<string, number>();
    const incomeMap = new Map<string, number>();

    for (const transaction of transactions) {
      const amount = Number(transaction.amount) || 0;
      const category = this.getDisplayCategory(transaction);

      if (transaction.type === 'EXPENSE') {
        expenseMap.set(category, (expenseMap.get(category) ?? 0) + amount);
      } else {
        incomeMap.set(category, (incomeMap.get(category) ?? 0) + amount);
      }
    }

    const expenseEntries = [...expenseMap.entries()].sort((a, b) => b[1] - a[1]);
    const incomeEntries = [...incomeMap.entries()].sort((a, b) => b[1] - a[1]);

    this.expenseCategoryLabels = expenseEntries.map(([label]) => label);
    this.expenseCategoryData = expenseEntries.map(([, value]) => this.round(value));
    this.incomeCategoryLabels = incomeEntries.map(([label]) => label);
    this.incomeCategoryData = incomeEntries.map(([, value]) => this.round(value));
  }

  private buildAssetSeries(): void {
    const assets = this.dashboard?.assets ?? [];
    const byName = new Map<string, number>();

    for (const asset of assets) {
      const name = (asset.name || 'Unbenannt').trim() || 'Unbenannt';
      const value = Number(asset.value) || 0;
      byName.set(name, (byName.get(name) ?? 0) + value);
    }

    const entries = [...byName.entries()].sort((a, b) => b[1] - a[1]);
    this.assetChartLabels = entries.map(([label]) => label);
    this.assetChartData = entries.map(([, value]) => this.round(value));
  }

  private buildTrendSeries(transactions: Transaction[]): void {
    const bucketMap = new Map<string, { income: number; expense: number }>();

    for (const transaction of transactions) {
      const bucket = this.getTrendBucket(transaction.date);
      const amount = Number(transaction.amount) || 0;
      const current = bucketMap.get(bucket) ?? { income: 0, expense: 0 };

      if (transaction.type === 'INCOME') {
        current.income += amount;
      } else {
        current.expense += amount;
      }

      bucketMap.set(bucket, current);
    }

    const sortedKeys = [...bucketMap.keys()].sort((a, b) => a.localeCompare(b));
    this.trendLabels = sortedKeys.map((key) => this.formatTrendLabel(key));
    this.trendIncomeData = sortedKeys.map((key) => this.round(bucketMap.get(key)?.income ?? 0));
    this.trendExpenseData = sortedKeys.map((key) => this.round(bucketMap.get(key)?.expense ?? 0));
    this.trendNetData = sortedKeys.map((key) => {
      const item = bucketMap.get(key);
      return this.round((item?.income ?? 0) - (item?.expense ?? 0));
    });
  }

  private getTrendBucket(dateString: string): string {
    if (this.trendGranularity === 'year') {
      return dateString.slice(0, 4);
    }

    if (this.trendGranularity === 'month') {
      return dateString.slice(0, 7);
    }

    return this.getIsoWeekKey(dateString);
  }

  private formatTrendLabel(bucket: string): string {
    if (this.trendGranularity === 'year') {
      return bucket;
    }

    if (this.trendGranularity === 'month') {
      const [yearRaw, monthRaw] = bucket.split('-');
      const year = Number(yearRaw);
      const month = Number(monthRaw);
      if (!Number.isFinite(year) || !Number.isFinite(month)) {
        return bucket;
      }

      const date = new Date(year, month - 1, 1);
      return new Intl.DateTimeFormat('de-AT', { month: 'short', year: '2-digit' }).format(date);
    }

    const [year, week] = bucket.split('-W');
    return `W${week}/${year}`;
  }

  private getIsoWeekKey(dateString: string): string {
    const date = new Date(`${dateString}T12:00:00`);
    const day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - day + 3);

    const firstThursday = new Date(date.getFullYear(), 0, 4);
    const firstDay = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstDay + 3);

    const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / DashboardPageComponent.MS_PER_WEEK);
    return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private normalizeCategoryLabel(category: string | null | undefined, type: TransactionType): string {
    const normalized = (category || 'Unkategorisiert').trim() || 'Unkategorisiert';

    if (type === 'INCOME' && normalized === 'Einnahmen') {
      return 'Sonstige Einnahmen';
    }

    if (type === 'EXPENSE' && normalized === 'Ausgaben') {
      return 'Sonstige Ausgaben';
    }

    return normalized;
  }

  private getDisplayCategory(transaction: Transaction): string {
    const normalizedCategory = this.normalizeCategoryLabel(transaction.category, transaction.type);

    if (normalizedCategory !== 'Sonstige Einnahmen' && normalizedCategory !== 'Sonstige Ausgaben') {
      return normalizedCategory;
    }

    return this.inferCategoryFromDescription(transaction.description, transaction.type, normalizedCategory);
  }

  private inferCategoryFromDescription(description: string | null | undefined, type: TransactionType, fallback: string): string {
    const normalized = this.normalizeForMatching(description);

    if (type === 'INCOME') {
      if (this.containsAny(normalized, 'GEHALT', 'LOHN', 'SALARY')) return 'Gehalt';
      if (this.containsAny(normalized, 'HONORAR', 'FREELANCE', 'SELBSTSTAENDIG', 'SELBSTANDIG')) return 'Selbststaendige Arbeit';
      if (this.containsAny(normalized, 'ZINS', 'INTEREST')) return 'Zinsen';
      if (this.containsAny(normalized, 'BONUS', 'PRAMIE', 'PRAEMIE')) return 'Bonus';
      if (this.containsAny(normalized, 'RUECKERSTATTUNG', 'RUCKERSTATTUNG', 'REFUND', 'RETURE', 'RETOUR')) return 'Rueckerstattung';
      if (this.containsAny(normalized, 'BEIHILFE', 'KINDERGELD', 'FAMILIENBEIHILFE', 'FOERDERUNG', 'FORDERUNG')) return 'Beihilfe';
      if (this.containsAny(normalized, 'UEBERWEISUNG', 'UBERWEISUNG', 'SCT', 'SEPA', 'GUTSCHRIFT')) return 'Ueberweisung Eingang';
      return fallback;
    }

    if (this.containsAny(normalized, 'MIETE', 'RENT')) return 'Miete';
    if (this.containsAny(normalized, 'SPAR', 'BILLA', 'HOFER', 'LIDL', 'PENNY', 'DM', 'MPRICE', 'M-PREIS', 'MPREIS')) return 'Lebensmittel';
    if (this.containsAny(normalized, 'RESTAURANT', 'CAFE', 'PIZZA', 'MCDONALD', 'BURGER', 'LIEFERANDO', 'DOENER', 'KEBAB')) return 'Essen gehen';
    if (this.containsAny(normalized, 'AMAZON', 'ZALANDO', 'H&M', 'HM', 'IKEA')) return 'Shopping';
    if (this.containsAny(normalized, 'SHELL', 'OMV', 'BP', 'JET', 'TANK', 'TANKSTELLE')) return 'Tanken';
    if (this.containsAny(normalized, 'OEBB', 'WIENER LINIEN', 'UBER', 'BOLT', 'TAXI', 'PARKEN')) return 'Transport';
    if (this.containsAny(normalized, 'STROM', 'GAS', 'ENERGIE', 'WASSER', 'INTERNET', 'A1', 'MAGENTA', 'DREI')) return 'Fixkosten';
    if (this.containsAny(normalized, 'VERSICHERUNG', 'ALLIANZ', 'UNIQA', 'DONAU')) return 'Versicherung';
    if (this.containsAny(normalized, 'ARZT', 'APOTHEKE', 'MEDIK', 'KRANKEN')) return 'Gesundheit';
    if (this.containsAny(normalized, 'NETFLIX', 'SPOTIFY', 'DISNEY', 'STEAM', 'PLAYSTATION', 'XBOX')) return 'Freizeit';
    if (this.containsAny(normalized, 'BAR', 'BANKOMAT', 'ATM', 'BARGELD')) return 'Barbehebung';
    if (this.containsAny(normalized, 'LASTSCHRIFT', 'DIRECT DEBIT')) return 'Lastschrift';
    if (this.containsAny(normalized, 'UEBERWEISUNG', 'UBERWEISUNG', 'SCT', 'SEPA', 'TRANSFER')) return 'Ueberweisung Ausgang';
    if (this.containsAny(normalized, 'POS', 'KARTENZAHLUNG', 'CARD')) return 'Kartenzahlung';

    return fallback;
  }

  private normalizeForMatching(text: string | null | undefined): string {
    return (text || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private containsAny(text: string, ...keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  private isDateInActiveRange(date: string): boolean {
    if (!this.activeFrom || !this.activeTo) {
      return true;
    }

    return date >= this.activeFrom && date <= this.activeTo;
  }

  private applyTransactionLocally(transaction: Transaction): void {
    if (!this.dashboard) {
      return;
    }

    const current = this.dashboard.transactions.filter((item) => item.id !== transaction.id);
    this.dashboard.transactions = [transaction, ...current].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      return dateCompare !== 0 ? dateCompare : b.id - a.id;
    });

    this.recalculateDashboardTotals();
    this.rebuildVisualSeries();
  }

  private applySubscriptionLocally(subscription: Subscription): void {
    if (!this.dashboard) {
      return;
    }

    const current = this.dashboard.subscriptions.filter((item) => item.id !== subscription.id);
    this.dashboard.subscriptions = [subscription, ...current];
    this.recalculateDashboardTotals();
    this.rebuildVisualSeries();
  }

  private applyAssetLocally(asset: Asset): void {
    if (!this.dashboard) {
      return;
    }

    const current = this.dashboard.assets.filter((item) => item.id !== asset.id);
    this.dashboard.assets = [asset, ...current];
    this.recalculateDashboardTotals();
    this.rebuildVisualSeries();
  }

  private recalculateDashboardTotals(): void {
    if (!this.dashboard) {
      return;
    }

    const totalIncome = this.dashboard.transactions
      .filter((item) => item.type === 'INCOME')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const totalExpenses = this.dashboard.transactions
      .filter((item) => item.type === 'EXPENSE')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    const totalSubscriptions = this.dashboard.subscriptions
      .reduce((sum, item) => sum + (Number(item.monthlyCost) || 0), 0);

    const totalAssets = this.dashboard.assets
      .reduce((sum, item) => sum + (Number(item.value) || 0), 0);

    this.dashboard.totalIncome = this.round(totalIncome);
    this.dashboard.totalExpenses = this.round(totalExpenses);
    this.dashboard.totalSubscriptions = this.round(totalSubscriptions);
    this.dashboard.totalAssets = this.round(totalAssets);
    this.dashboard.totalBalance = this.round(totalAssets + totalIncome - totalExpenses);
  }

  private refreshDashboardAfterMutation(targetDate?: string): void {
    let from = this.activeFrom || this.customFrom;
    let to = this.activeTo || this.customTo;

    if (!from || !to) {
      this.applyPreset('month');
      return;
    }

    if (targetDate && !this.isDateInActiveRange(targetDate)) {
      from = targetDate < from ? targetDate : from;
      to = targetDate > to ? targetDate : to;
      this.filterMode = 'custom';
      this.customFrom = from;
      this.customTo = to;
    }

    this.loadDashboard(from, to);
  }

  addOrUpdateBudget(): void {
    const category = this.budgetCategory.trim();
    if (!category || !this.budgetAmount || this.budgetAmount <= 0) {
      this.budgetError = 'Bitte Kategorie und gueltiges Budget angeben.';
      this.budgetMessage = '';
      return;
    }

    const budget = this.round(this.budgetAmount);
    const spent = this.getSpentForBudgetCategory(category);
    if (spent > budget) {
      this.pendingBudgetConfirmation = {
        category,
        budget,
        spent,
        overdraw: this.round(spent - budget)
      };
      this.budgetError = '';
      this.budgetMessage = '';
      return;
    }

    this.saveBudget(category, budget);
  }

  confirmBudgetOverdraw(): void {
    if (!this.pendingBudgetConfirmation) {
      return;
    }

    const { category, budget } = this.pendingBudgetConfirmation;
    this.saveBudget(category, budget);
  }

  cancelBudgetOverdraw(): void {
    this.pendingBudgetConfirmation = null;
    this.budgetError = 'Budget wurde nicht gespeichert.';
    this.budgetMessage = '';
  }

  private saveBudget(category: string, budget: number): void {
    this.budgets.set(category, budget);
    this.persistBudgets();
    this.rebuildBudgetStatuses();

    this.budgetCategory = '';
    this.budgetAmount = null;
    this.pendingBudgetConfirmation = null;
    this.budgetError = '';
    this.budgetMessage = 'Budget gespeichert.';
  }

  removeBudget(category: string): void {
    this.budgets.delete(category);
    this.persistBudgets();
    this.rebuildBudgetStatuses();
    this.budgetMessage = 'Budget entfernt.';
    this.budgetError = '';
  }

  getBudgetStateLabel(state: BudgetState): string {
    if (state === 'over') {
      return 'Ueberzogen';
    }
    if (state === 'warn') {
      return 'Nahe am Limit';
    }
    return 'Im Limit';
  }

  abs(value: number): number {
    return Math.abs(value);
  }

  private initializeTheme(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const storedTheme = localStorage.getItem(DashboardPageComponent.THEME_STORAGE_KEY);
    if (storedTheme === 'dark') {
      this.darkMode = true;
    } else if (storedTheme === 'light') {
      this.darkMode = false;
    } else {
      this.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    this.applyTheme();
  }

  private initializeSidebar(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.sidebarCollapsed = window.innerWidth < 1400;
  }

  private applyTheme(): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.classList.toggle('theme-dark', this.darkMode);

    if (typeof window !== 'undefined') {
      localStorage.setItem(DashboardPageComponent.THEME_STORAGE_KEY, this.darkMode ? 'dark' : 'light');
    }
  }

  private initializeBudgets(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const raw = localStorage.getItem(DashboardPageComponent.BUDGET_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const data = JSON.parse(raw) as Record<string, number>;
      for (const [category, value] of Object.entries(data)) {
        if (category.trim() && Number.isFinite(value) && value > 0) {
          this.budgets.set(category, Number(value));
        }
      }
    } catch {
      // Ignore malformed localStorage payloads.
    }
  }

  private persistBudgets(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: Record<string, number> = {};
    for (const [category, value] of this.budgets.entries()) {
      payload[category] = value;
    }

    localStorage.setItem(DashboardPageComponent.BUDGET_STORAGE_KEY, JSON.stringify(payload));
  }

  private getSpentForBudgetCategory(category: string): number {
    const transactions = this.dashboard?.transactions ?? [];
    const budgetCategoryKey = this.normalizeBudgetCategoryKey(category);
    const spent = transactions
      .filter((transaction) => {
        return transaction.type === 'EXPENSE'
          && this.normalizeBudgetCategoryKey(this.getDisplayCategory(transaction)) === budgetCategoryKey;
      })
      .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);

    return this.round(spent);
  }

  private normalizeBudgetCategoryKey(category: string): string {
    return category.trim().toLocaleLowerCase('de-AT');
  }

  private rebuildBudgetStatuses(): void {
    const transactions = this.dashboard?.transactions ?? [];
    const spentByCategory = new Map<string, number>();

    for (const transaction of transactions) {
      if (transaction.type !== 'EXPENSE') {
        continue;
      }
      const category = this.normalizeBudgetCategoryKey(this.getDisplayCategory(transaction));
      spentByCategory.set(category, (spentByCategory.get(category) ?? 0) + (Number(transaction.amount) || 0));
    }

    const statuses: BudgetStatus[] = [];
    for (const [category, budget] of this.budgets.entries()) {
      const spent = this.round(spentByCategory.get(this.normalizeBudgetCategoryKey(category)) ?? 0);
      const remaining = this.round(budget - spent);
      const usagePercentRaw = budget > 0 ? (spent / budget) * 100 : 0;
      const usagePercent = this.round(Math.max(0, usagePercentRaw));
      const usagePercentCapped = Math.min(100, usagePercent);

      let state: BudgetState = 'ok';
      if (usagePercent >= 100) {
        state = 'over';
      } else if (usagePercent >= 85) {
        state = 'warn';
      }

      statuses.push({
        category,
        budget: this.round(budget),
        spent,
        remaining,
        usagePercent,
        usagePercentCapped,
        state
      });
    }

    this.budgetStatuses = statuses.sort((a, b) => a.category.localeCompare(b.category));
  }
}
