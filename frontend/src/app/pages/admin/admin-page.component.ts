import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { AdminUser, UserRole } from '../../models/api.models';
import { ApiService } from '../../services/api.service';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.css'
})
export class AdminPageComponent implements OnInit {
  users: AdminUser[] = [];
  loading = true;
  actionLoadingUserId: number | null = null;
  message = '';
  errorMessage = '';

  constructor(
    private readonly apiService: ApiService,
    private readonly authService: AuthService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  get currentUsername(): string {
    return this.authService.getUsername();
  }

  get adminCount(): number {
    return this.users.filter((user) => user.role === 'ADMIN').length;
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMessage = '';

    this.apiService.getAdminUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        if (error?.status === 401 || error?.status === 403) {
          this.errorMessage = 'Admin-Daten konnten nicht geladen werden. Bitte abmelden und neu anmelden.';
        } else {
          this.errorMessage = 'Admin-Daten konnten nicht geladen werden.';
        }
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  setRole(user: AdminUser, role: UserRole): void {
    if (user.role === role) {
      return;
    }

    this.actionLoadingUserId = user.id;
    this.message = '';
    this.errorMessage = '';

    this.apiService.updateAdminUserRole(user.id, role).subscribe({
      next: (updatedUser) => {
        this.users = this.users.map((item) => item.id === updatedUser.id ? updatedUser : item);
        this.message = `${updatedUser.username} ist jetzt ${this.getRoleLabel(updatedUser.role)}.`;
        this.actionLoadingUserId = null;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message ?? 'Rolle konnte nicht geaendert werden.';
        this.actionLoadingUserId = null;
        this.cdr.detectChanges();
      }
    });
  }

  getRoleLabel(role: UserRole): string {
    return role === 'ADMIN' ? 'Admin' : 'Benutzer';
  }
}
