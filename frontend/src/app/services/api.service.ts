import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import {
  AdminUser,
  AssetRequest,
  Asset,
  DashboardResponse,
  DateFilter,
  FileImportResponse,
  Subscription,
  SubscriptionRequest,
  Transaction,
  TransactionRequest
} from '../models/api.models';
import { API_BASE_URL } from './api.base';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly requestTimeoutMs = 10000;

  constructor(private readonly http: HttpClient) {}

  getDashboard(filter: DateFilter = {}): Observable<DashboardResponse> {
    let params = new HttpParams();
    if (filter.from) {
      params = params.set('from', filter.from);
    }
    if (filter.to) {
      params = params.set('to', filter.to);
    }

    return this.http.get<DashboardResponse>(`${API_BASE_URL}/dashboard`, { params });
  }

  getTransactions(filter: DateFilter = {}): Observable<Transaction[]> {
    let params = new HttpParams();
    if (filter.from) {
      params = params.set('from', filter.from);
    }
    if (filter.to) {
      params = params.set('to', filter.to);
    }

    return this.http.get<Transaction[]>(`${API_BASE_URL}/transactions`, { params });
  }

  getSubscriptions(): Observable<Subscription[]> {
    return this.http.get<Subscription[]>(`${API_BASE_URL}/subscriptions`);
  }

  getAssets(): Observable<Asset[]> {
    return this.http.get<Asset[]>(`${API_BASE_URL}/assets`);
  }

  createTransaction(payload: TransactionRequest): Observable<Transaction> {
    return this.http.post<Transaction>(`${API_BASE_URL}/transactions`, payload);
  }

  createSubscription(payload: SubscriptionRequest): Observable<Subscription> {
    return this.http.post<Subscription>(`${API_BASE_URL}/subscriptions`, payload);
  }

  createAsset(payload: AssetRequest): Observable<Asset> {
    return this.http.post<Asset>(`${API_BASE_URL}/assets`, payload);
  }

  uploadTransactions(file: File): Observable<FileImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<FileImportResponse>(`${API_BASE_URL}/import/transactions`, formData);
  }

  deleteAllData(): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/dashboard/all-data`);
  }

  getAdminUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${API_BASE_URL}/admin/users`).pipe(
      timeout(this.requestTimeoutMs)
    );
  }

  updateAdminUserRole(userId: number, role: 'USER' | 'ADMIN'): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${API_BASE_URL}/admin/users/${userId}/role`, { role }).pipe(
      timeout(this.requestTimeoutMs)
    );
  }

  deleteAdminUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/admin/users/${userId}`).pipe(
      timeout(this.requestTimeoutMs)
    );
  }
}
