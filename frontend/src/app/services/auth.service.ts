import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { API_BASE_URL } from './api.base';
import { AuthRequest, AuthResponse } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenStorageKey = 'finance_dashboard_token';
  private readonly userStorageKey = 'finance_dashboard_user';

  private readonly authenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  readonly authenticated$ = this.authenticatedSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  login(payload: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_BASE_URL}/auth/login`, payload).pipe(
      tap((response) => this.persistSession(response))
    );
  }

  register(payload: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_BASE_URL}/auth/register`, payload).pipe(
      tap((response) => this.persistSession(response))
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

  private persistSession(response: AuthResponse): void {
    if (this.isBrowser()) {
      localStorage.setItem(this.tokenStorageKey, response.token);
      localStorage.setItem(this.userStorageKey, response.username);
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
