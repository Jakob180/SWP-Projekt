import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, timeout } from 'rxjs';
import { API_BASE_URL } from './api.base';
import {
  AuthRequest,
  AuthResponse,
  MessageResponse,
  PendingVerification,
  PasswordCodeRequest,
  PasswordResetConfirmRequest,
  RegisterCodeRequest,
  RegisterConfirmRequest
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenStorageKey = 'finance_dashboard_token';
  private readonly userStorageKey = 'finance_dashboard_user';
  private readonly pendingVerificationStorageKey = 'finance_dashboard_pending_verification';
  private readonly requestTimeoutMs = 10000;

  private readonly authenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  readonly authenticated$ = this.authenticatedSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  login(payload: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_BASE_URL}/auth/login`, payload).pipe(
      timeout(this.requestTimeoutMs),
      tap((response) => this.persistSession(response))
    );
  }

  requestRegisterCode(payload: RegisterCodeRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${API_BASE_URL}/auth/register/request-code`, payload).pipe(
      timeout(this.requestTimeoutMs)
    );
  }

  confirmRegister(payload: RegisterConfirmRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_BASE_URL}/auth/register/confirm`, payload).pipe(
      timeout(this.requestTimeoutMs),
      tap((response) => this.persistSession(response))
    );
  }

  requestPasswordCode(payload: PasswordCodeRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${API_BASE_URL}/auth/password/request-code`, payload).pipe(
      timeout(this.requestTimeoutMs)
    );
  }

  confirmPasswordReset(payload: PasswordResetConfirmRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${API_BASE_URL}/auth/password/confirm`, payload).pipe(
      timeout(this.requestTimeoutMs)
    );
  }

  logout(): void {
    if (this.isBrowser()) {
      localStorage.removeItem(this.tokenStorageKey);
      localStorage.removeItem(this.userStorageKey);
    }
    this.authenticatedSubject.next(false);
  }

  getToken(): string | null {
    if (!this.isBrowser()) {
      return null;
    }

    return localStorage.getItem(this.tokenStorageKey);
  }

  getUsername(): string {
    if (!this.isBrowser()) {
      return '';
    }

    return localStorage.getItem(this.userStorageKey) ?? '';
  }

  isAuthenticated(): boolean {
    return this.hasToken();
  }

  setPendingVerification(payload: PendingVerification): void {
    if (!this.isBrowser()) {
      return;
    }

    localStorage.setItem(this.pendingVerificationStorageKey, JSON.stringify(payload));
  }

  getPendingVerification(): PendingVerification | null {
    if (!this.isBrowser()) {
      return null;
    }

    const stored = localStorage.getItem(this.pendingVerificationStorageKey);
    if (!stored) {
      return null;
    }

    try {
      const parsed = JSON.parse(stored) as PendingVerification;
      if (!parsed?.email || (parsed.mode !== 'register' && parsed.mode !== 'password')) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  clearPendingVerification(): void {
    if (!this.isBrowser()) {
      return;
    }

    localStorage.removeItem(this.pendingVerificationStorageKey);
  }

  private persistSession(response: AuthResponse): void {
    if (this.isBrowser()) {
      localStorage.setItem(this.tokenStorageKey, response.token);
      localStorage.setItem(this.userStorageKey, response.username);
      localStorage.removeItem(this.pendingVerificationStorageKey);
    }
    this.authenticatedSubject.next(true);
  }

  private hasToken(): boolean {
    const token = this.getToken();
    return !!token;
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }
}
