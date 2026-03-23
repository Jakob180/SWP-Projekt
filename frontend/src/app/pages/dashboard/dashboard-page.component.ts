import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChartPanelComponent } from '../../components/chart-panel/chart-panel.component';
import { UploadComponent } from '../../components/upload/upload.component';
import { DashboardResponse, TransactionType } from '../../models/api.models';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartPanelComponent, UploadComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css'
})
export class DashboardPageComponent implements OnInit {
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

  readonly palette = ['#0ea5e9', '#06b6d4', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

  constructor(
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.applyPreset('month');
  }

  get username(): string {
    return this.authService.getUsername();
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
      this.errorMessage = 'Please provide both custom dates.';
      return;
    }

    this.loadDashboard(this.customFrom, this.customTo);
  }

  refreshAfterImport(): void {
    this.loadDashboard(this.activeFrom, this.activeTo);
  }

  addTransaction(): void {
    if (!this.transactionAmount || this.transactionAmount <= 0 || !this.transactionCategory.trim() || !this.transactionDate) {
      this.actionError = 'Please fill amount, category and date for the transaction.';
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
        this.actionMessage = 'Transaction saved.';
        this.actionLoading = false;
        this.refreshAfterImport();
      },
      error: (error) => {
        this.actionLoading = false;
        this.actionError = error?.error?.message ?? 'Could not create transaction.';
      }
    });
  }

  addSubscription(): void {
    if (!this.subscriptionName.trim() || !this.subscriptionMonthlyCost || this.subscriptionMonthlyCost <= 0) {
      this.actionError = 'Please enter name and monthly cost for the subscription.';
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
        this.actionMessage = 'Subscription saved.';
        this.actionLoading = false;
        this.refreshAfterImport();
      },
      error: (error) => {
        this.actionLoading = false;
        this.actionError = error?.error?.message ?? 'Could not create subscription.';
      }
    });
  }

  addAsset(): void {
    if (!this.assetName.trim() || this.assetValue == null || this.assetValue < 0) {
      this.actionError = 'Please enter name and value for the asset.';
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
        this.actionMessage = 'Asset saved.';
        this.actionLoading = false;
        this.refreshAfterImport();
      },
      error: (error) => {
        this.actionLoading = false;
        this.actionError = error?.error?.message ?? 'Could not create asset.';
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2
    }).format(value ?? 0);
  }

  get expenseLabels(): string[] {
    return this.dashboard?.expenseByCategory.map((item) => item.label) ?? [];
  }

  get expenseData(): number[] {
    return this.dashboard?.expenseByCategory.map((item) => item.value) ?? [];
  }

  get assetLabels(): string[] {
    return this.dashboard?.assetsByName.map((item) => item.label) ?? [];
  }

  get assetData(): number[] {
    return this.dashboard?.assetsByName.map((item) => item.value) ?? [];
  }

  get monthlyLabels(): string[] {
    return this.dashboard?.monthlyOverview.map((item) => item.month) ?? [];
  }

  get monthlyIncomeData(): number[] {
    return this.dashboard?.monthlyOverview.map((item) => item.income) ?? [];
  }

  get monthlyExpenseData(): number[] {
    return this.dashboard?.monthlyOverview.map((item) => item.expense) ?? [];
  }

  get yearlyLabels(): string[] {
    return this.dashboard?.yearlyOverview.map((item) => String(item.year)) ?? [];
  }

  get yearlyIncomeData(): number[] {
    return this.dashboard?.yearlyOverview.map((item) => item.income) ?? [];
  }

  get yearlyExpenseData(): number[] {
    return this.dashboard?.yearlyOverview.map((item) => item.expense) ?? [];
  }

  private loadDashboard(from: string, to: string): void {
    this.loading = true;
    this.errorMessage = '';
    this.activeFrom = from;
    this.activeTo = to;

    this.apiService.getDashboard({ from, to }).subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.error?.message ?? 'Could not load dashboard data.';
      }
    });
  }

  private toDateInput(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private todayDateString(): string {
    return this.toDateInput(new Date());
  }
}
