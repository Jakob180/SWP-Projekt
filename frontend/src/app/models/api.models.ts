export type TransactionType = 'INCOME' | 'EXPENSE';

export interface AuthRequest {
  identifier: string;
  password: string;
}

export interface RegisterCodeRequest {
  username: string;
  email: string;
  password: string;
}

export interface RegisterConfirmRequest {
  email: string;
  code: string;
}

export interface PasswordCodeRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface MessageResponse {
  message: string;
}

export interface AuthResponse {
  userId: number;
  username: string;
  token: string;
}

export type VerificationMode = 'register' | 'password';

export interface PendingVerification {
  mode: VerificationMode;
  email: string;
}

export interface Transaction {
  id: number;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  date: string;
}

export interface TransactionRequest {
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  date: string;
}

export interface Subscription {
  id: number;
  name: string;
  monthlyCost: number;
}

export interface SubscriptionRequest {
  name: string;
  monthlyCost: number;
}

export interface Asset {
  id: number;
  name: string;
  value: number;
}

export interface AssetRequest {
  name: string;
  value: number;
}

export interface BreakdownItem {
  label: string;
  value: number;
}

export interface MonthlyOverviewItem {
  month: string;
  income: number;
  expense: number;
}

export interface YearlyOverviewItem {
  year: number;
  income: number;
  expense: number;
}

export interface DashboardResponse {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  totalSubscriptions: number;
  totalAssets: number;
  expenseByCategory: BreakdownItem[];
  assetsByName: BreakdownItem[];
  monthlyOverview: MonthlyOverviewItem[];
  yearlyOverview: YearlyOverviewItem[];
  transactions: Transaction[];
  subscriptions: Subscription[];
  assets: Asset[];
}

export interface FileImportResponse {
  importedTransactions: number;
  importedFrom: string | null;
  importedTo: string | null;
}

export interface DateFilter {
  from?: string;
  to?: string;
}
