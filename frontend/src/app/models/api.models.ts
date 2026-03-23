export type TransactionType = 'INCOME' | 'EXPENSE';

export interface AuthRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  userId: number;
  username: string;
  token: string;
}

export interface Transaction {
  id: number;
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

export interface Asset {
  id: number;
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
}

export interface DateFilter {
  from?: string;
  to?: string;
}
