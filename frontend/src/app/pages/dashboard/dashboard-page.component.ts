import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChartPanelComponent } from '../../components/chart-panel/chart-panel.component';
import { UploadComponent } from '../../components/upload/upload.component';
import { DashboardResponse, FileImportResponse, Transaction, TransactionType } from '../../models/api.models';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

type DashboardView = 'overview' | 'income' | 'expense' | 'period';

interface SidebarNavItem {
  id: DashboardView;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}

interface CategoryBudget {
  category: string;
  amount: number;
}

interface CategoryBudgetStatus {
  category: string;
  budget: number;
  spent: number;
  remaining: number;
  usagePercent: number;
  usagePercentCapped: number;
  state: 'ok' | 'warn' | 'over';
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartPanelComponent, UploadComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css'
})
export class DashboardPageComponent implements OnInit {
  private static readonly MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  private static readonly THEME_STORAGE_KEY = 'finance_dashboard_theme';
  private static readonly BUDGET_STORAGE_PREFIX = 'finance_dashboard_budgets';

  dashboard?: DashboardResponse;
  loading = true;
  errorMessage = '';
  actionMessage = '';
  actionError = '';
  actionLoading = false;

  filterMode: 'month' | 'year' | 'custom' = 'month';
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
  categoryBudgets: CategoryBudget[] = [];

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
  readonly sidebarNavItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Uebersicht', shortLabel: 'Ue', icon: 'U', description: 'Alle Kennzahlen und Diagramme' },
    { id: 'income', label: 'Einnahmen', shortLabel: 'Ein', icon: '+', description: 'Nur Einnahmen und Trends' },
    { id: 'expense', label: 'Ausgaben', shortLabel: 'Aus', icon: '-', description: 'Nur Ausgaben und Trends' },
    { id: 'period', label: 'Zeitraum', shortLabel: 'Zeit', icon: 'Z', description: 'Woche, Monat oder Jahr vergleichen' }
  ];

  constructor(
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.initializeSidebar();
    this.initializeTheme();
    this.loadBudgets();
    this.applyPreset('month');
  }

  get username(): string {
    return this.authService.getUsername();
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

  get budgetStatuses(): CategoryBudgetStatus[] {
    const spentMap = this.getExpenseMapByCategory();
    return this.categoryBudgets
      .map((budget) => {
        const spent = this.round(spentMap.get(this.normalizeCategory(budget.category)) ?? 0);
        const usagePercent = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
        const roundedUsage = this.round(usagePercent);
        const usagePercentCapped = Math.min(100, Math.max(0, roundedUsage));

        let state: 'ok' | 'warn' | 'over' = 'ok';
        if (roundedUsage > 100) {
          state = 'over';
        } else if (roundedUsage >= 80) {
          state = 'warn';
        }

        return {
          category: budget.category,
          budget: this.round(budget.amount),
          spent,
          remaining: this.round(budget.amount - spent),
          usagePercent: roundedUsage,
          usagePercentCapped,
          state
        };
      })
      .sort((a, b) => b.usagePercent - a.usagePercent);
  }

  setView(view: DashboardView): void {
    this.activeView = view;
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

  applyPreset(mode: 'month' | 'year'): void {
    this.filterMode = mode;
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

  refreshAfterImport(response?: FileImportResponse): void {
    if (response?.importedFrom && response?.importedTo) {
      this.filterMode = 'custom';
      this.customFrom = response.importedFrom;
      this.customTo = response.importedTo;
      this.loadDashboard(response.importedFrom, response.importedTo);
      this.actionMessage = `${response.importedTransactions} Transaktionen wurden importiert und im passenden Zeitraum geladen.`;
      this.actionError = '';
      return;
    }

    this.loadDashboard(this.activeFrom, this.activeTo);
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
      next: () => {
        this.transactionAmount = null;
        this.transactionCategory = '';
        this.transactionDescription = '';
        this.transactionType = 'EXPENSE';
        this.transactionDate = this.todayDateString();
        this.actionMessage = 'Transaktion gespeichert.';
        this.actionLoading = false;
        this.refreshAfterImport();
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
      next: () => {
        this.subscriptionName = '';
        this.subscriptionMonthlyCost = null;
        this.actionMessage = 'Abo gespeichert.';
        this.actionLoading = false;
        this.refreshAfterImport();
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
      next: () => {
        this.assetName = '';
        this.assetValue = null;
        this.actionMessage = 'Asset gespeichert.';
        this.actionLoading = false;
        this.refreshAfterImport();
      },
      error: (error) => {
        this.actionLoading = false;
        this.actionError = error?.error?.message ?? 'Asset konnte nicht gespeichert werden.';
      }
    });
  }

  addOrUpdateBudget(): void {
    const category = this.budgetCategory.trim();
    const amount = this.budgetAmount ?? 0;

    if (!category) {
      this.budgetError = 'Bitte eine Kategorie fuer das Budget angeben.';
      this.budgetMessage = '';
      return;
    }

    if (amount <= 0) {
      this.budgetError = 'Bitte einen Budgetbetrag groesser als 0 angeben.';
      this.budgetMessage = '';
      return;
    }

    const normalized = this.normalizeCategory(category);
    const existingIndex = this.categoryBudgets.findIndex((item) => this.normalizeCategory(item.category) === normalized);
    const nextBudget: CategoryBudget = { category, amount: this.round(amount) };

    if (existingIndex >= 0) {
      this.categoryBudgets[existingIndex] = nextBudget;
      this.budgetMessage = `Budget fuer "${category}" wurde aktualisiert.`;
    } else {
      this.categoryBudgets = [...this.categoryBudgets, nextBudget];
      this.budgetMessage = `Budget fuer "${category}" wurde hinzugefuegt.`;
    }

    this.budgetError = '';
    this.budgetCategory = '';
    this.budgetAmount = null;
    this.persistBudgets();
  }

  removeBudget(category: string): void {
    this.categoryBudgets = this.categoryBudgets.filter((item) => this.normalizeCategory(item.category) !== this.normalizeCategory(category));
    this.budgetMessage = `Budget fuer "${category}" wurde entfernt.`;
    this.budgetError = '';
    this.persistBudgets();
  }

  getBudgetStateLabel(state: 'ok' | 'warn' | 'over'): string {
    if (state === 'over') {
      return 'Ueber Budget';
    }

    if (state === 'warn') {
      return 'Achtung';
    }

    return 'Im Plan';
  }

  abs(value: number): number {
    return Math.abs(value);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('de-AT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2
    }).format(value ?? 0);
  }

  private loadDashboard(from: string, to: string): void {
    this.loading = true;
    this.errorMessage = '';
    this.activeFrom = from;
    this.activeTo = to;

    this.apiService.getDashboard({ from, to }).subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.rebuildVisualSeries();
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.error?.message ?? 'Dashboard-Daten konnten nicht geladen werden.';
      }
    });
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
      const category = (transaction.category || 'Unkategorisiert').trim() || 'Unkategorisiert';

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
    const assets = this.dashboard?.assetsByName ?? [];
    this.assetChartLabels = assets.map((item) => item.label);
    this.assetChartData = assets.map((item) => this.round(Number(item.value) || 0));
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

  private getExpenseMapByCategory(): Map<string, number> {
    const map = new Map<string, number>();
    const expenses = (this.dashboard?.transactions ?? []).filter((transaction) => transaction.type === 'EXPENSE');

    for (const expense of expenses) {
      const category = (expense.category || 'Unkategorisiert').trim() || 'Unkategorisiert';
      const normalized = this.normalizeCategory(category);
      const amount = Number(expense.amount) || 0;
      map.set(normalized, this.round((map.get(normalized) ?? 0) + amount));
    }

    return map;
  }

  private normalizeCategory(value: string): string {
    return value.trim().toLocaleLowerCase('de-AT');
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

    this.sidebarCollapsed = window.innerWidth < 1100;
  }

  private loadBudgets(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const raw = localStorage.getItem(this.budgetStorageKey);
    if (!raw) {
      this.categoryBudgets = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw) as CategoryBudget[];
      this.categoryBudgets = parsed
        .filter((entry) => typeof entry?.category === 'string' && Number(entry?.amount) > 0)
        .map((entry) => ({
          category: entry.category.trim(),
          amount: this.round(Number(entry.amount))
        }));
    } catch {
      this.categoryBudgets = [];
    }
  }

  private persistBudgets(): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(this.budgetStorageKey, JSON.stringify(this.categoryBudgets));
  }

  private get budgetStorageKey(): string {
    return `${DashboardPageComponent.BUDGET_STORAGE_PREFIX}_${this.username || 'anonymous'}`;
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
}
