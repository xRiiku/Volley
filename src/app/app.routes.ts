import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./features/shell/shell.component').then((m) => m.ShellComponent),
  },
];
