import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PendingVerification } from '../../models/api.models';

@Component({
  selector: 'app-verification-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './verification-page.component.html',
  styleUrl: './verification-page.component.css'
})
export class VerificationPageComponent {
  readonly verification: PendingVerification | null;
  code = '';
  newPassword = '';
  loading = false;
  infoMessage = '';
  errorMessage = '';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.verification = this.authService.getPendingVerification();

    if (!this.verification) {
      void this.router.navigateByUrl('/login');
    }
  }

  get title(): string {
    return this.verification?.mode === 'password'
      ? 'Code fuer Passwortaenderung'
      : 'Code fuer Registrierung';
  }

  get description(): string {
    if (!this.verification) {
      return '';
    }

    return this.verification.mode === 'password'
      ? `Wir haben einen Verifizierungscode an ${this.verification.email} geschickt.`
      : `Wir haben einen Registrierungscode an ${this.verification.email} geschickt.`;
  }

  submit(): void {
    if (!this.verification) {
      return;
    }

    this.loading = true;
    this.infoMessage = '';
    this.errorMessage = '';

    if (this.verification.mode === 'register') {
      this.authService.confirmRegister({
        email: this.verification.email,
        code: this.code.trim()
      }).subscribe({
        next: () => {
          this.loading = false;
          this.authService.clearPendingVerification();
          this.router.navigateByUrl('/dashboard');
        },
        error: (error) => {
          this.loading = false;
          this.errorMessage = error?.name === 'TimeoutError'
            ? 'Server antwortet nicht rechtzeitig. Bitte erneut versuchen.'
            : (error?.error?.message ?? 'Registrierung fehlgeschlagen.');
        }
      });
      return;
    }

    this.authService.confirmPasswordReset({
      email: this.verification.email,
      code: this.code.trim(),
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.loading = false;
        this.authService.clearPendingVerification();
        this.authService.logout();
        void this.redirectToLoginAfterPasswordReset();
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.name === 'TimeoutError'
          ? 'Server antwortet nicht rechtzeitig. Bitte erneut versuchen.'
          : (error?.error?.message ?? 'Passwort konnte nicht geaendert werden.');
      }
    });
  }

  backToLogin(): void {
    this.authService.clearPendingVerification();
    void this.router.navigateByUrl('/login');
  }

  private async redirectToLoginAfterPasswordReset(): Promise<void> {
    const navigated = await this.router.navigate(['/login'], {
      replaceUrl: true,
      queryParams: { message: 'password-reset-success' }
    });

    if (!navigated && typeof window !== 'undefined') {
      window.location.href = '/login?message=password-reset-success';
    }
  }
}
