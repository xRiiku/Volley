import { Routes } from '@angular/router';
import { AppShellComponent } from './features/app-shell/app-shell.component';

export const routes: Routes = [
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
  },

  // Aquí está tu comportamiento actual (login embebido si no hay sesión)
  {
    path: '',
    component: AppShellComponent,
  },

  { path: '**', redirectTo: '' },
];
