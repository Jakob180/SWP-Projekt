import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.css'
})
export class AuthPageComponent {
  mode: 'login' | 'register' | 'password' = 'login';
  identifier = '';
  username = '';
  email = '';
  password = '';
  loading = false;
  infoMessage = '';
  errorMessage = '';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    const message = this.route.snapshot.queryParamMap.get('message');
    if (message === 'password-reset-success') {
      this.mode = 'login';
      this.infoMessage = 'Passwort aktualisiert. Bitte jetzt anmelden.';
    }
  }

  switchMode(mode: 'login' | 'register' | 'password'): void {
    this.mode = mode;
    this.infoMessage = '';
    this.errorMessage = '';
  }

  submit(): void {
    if (this.mode === 'login') {
      this.submitLogin();
      return;
    }
    if (this.mode === 'register') {
      this.submitRegister();
      return;
    }
    this.submitPasswordReset();
  }

  private submitLogin(): void {
    this.loading = true;
    this.infoMessage = '';
    this.errorMessage = '';

    this.authService.login({
      identifier: this.identifier.trim(),
      password: this.password
    }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl('/dashboard');
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.name === 'TimeoutError'
          ? 'Server antwortet nicht rechtzeitig. Bitte erneut versuchen.'
          : (error?.error?.message ?? 'Anmeldung fehlgeschlagen.');
      }
    });
  }

  private submitRegister(): void {
    this.loading = true;
    this.infoMessage = '';
    this.errorMessage = '';

    this.authService.requestRegisterCode({
      username: this.username.trim(),
      email: this.email.trim(),
      password: this.password
    }).subscribe({
      next: () => {
        this.loading = false;
        this.authService.setPendingVerification({
          mode: 'register',
          email: this.email.trim()
        });
        this.router.navigateByUrl('/verify');
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.name === 'TimeoutError'
          ? 'Server antwortet nicht rechtzeitig. Bitte erneut versuchen.'
          : (error?.error?.message ?? 'Code konnte nicht versendet werden.');
      }
    });
  }

  private submitPasswordReset(): void {
    this.loading = true;
    this.infoMessage = '';
    this.errorMessage = '';

    this.authService.requestPasswordCode({ email: this.email.trim() }).subscribe({
      next: () => {
        this.loading = false;
        this.authService.setPendingVerification({
          mode: 'password',
          email: this.email.trim()
        });
        this.router.navigateByUrl('/verify');
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.name === 'TimeoutError'
          ? 'Server antwortet nicht rechtzeitig. Bitte erneut versuchen.'
          : (error?.error?.message ?? 'Code konnte nicht versendet werden.');
      }
    });
  }
}
