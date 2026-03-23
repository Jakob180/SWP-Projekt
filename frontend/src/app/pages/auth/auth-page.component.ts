import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.css'
})
export class AuthPageComponent {
  mode: 'login' | 'register' = 'login';
  username = '';
  password = '';
  loading = false;
  errorMessage = '';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  switchMode(mode: 'login' | 'register'): void {
    this.mode = mode;
    this.errorMessage = '';
  }

  submit(): void {
    this.loading = true;
    this.errorMessage = '';

    const payload = {
      username: this.username.trim(),
      password: this.password
    };

    const request$ = this.mode === 'login'
      ? this.authService.login(payload)
      : this.authService.register(payload);

    request$.subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl('/dashboard');
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.error?.message ?? 'Authentication failed.';
      }
    });
  }
}
