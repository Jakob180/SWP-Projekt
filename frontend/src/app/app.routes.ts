import { Routes } from '@angular/router';
import { AuthPageComponent } from './pages/auth/auth-page.component';
import { DashboardPageComponent } from './pages/dashboard/dashboard-page.component';
import { ImportsPageComponent } from './pages/imports/imports-page.component';
import { VerificationPageComponent } from './pages/verification/verification-page.component';
import { AdminPageComponent } from './pages/admin/admin-page.component';
import { adminGuard } from './guards/admin.guard';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: AuthPageComponent,
    canActivate: [guestGuard]
  },
  {
    path: 'verify',
    component: VerificationPageComponent,
    canActivate: [guestGuard]
  },
  {
    path: 'dashboard',
    component: DashboardPageComponent,
    canActivate: [authGuard]
  },
  {
    path: 'imports',
    component: ImportsPageComponent,
    canActivate: [authGuard]
  },
  {
    path: 'admin',
    component: AdminPageComponent,
    canActivate: [adminGuard]
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard'
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
