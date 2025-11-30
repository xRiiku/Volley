import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameLayoutComponent } from './features/game-layout/game-layout.component';
import { LoginComponent } from './features/login/login.component';
import { AuthService } from './core/auth/auth.service';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, AsyncPipe, GameLayoutComponent, LoginComponent],
  template: `
    <ng-container *ngIf="(auth.user$ | async) as user; else showLogin">
      <!-- Usuario autenticado: mostramos la app -->
      <app-game-layout></app-game-layout>
    </ng-container>

    <ng-template #showLogin>
      <!-- No autenticado: pantalla de login -->
      <app-login></app-login>
    </ng-template>
  `,
})
export class AppComponent {
  auth = inject(AuthService);
}
