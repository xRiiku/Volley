import { Component, inject } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { GameLayoutComponent } from '../game-layout/game-layout.component';
import { LoginComponent } from '../login/login.component';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, AsyncPipe, GameLayoutComponent, LoginComponent],
  template: `
    <ng-container *ngIf="(auth.user$ | async) as user; else showLogin">
      <app-game-layout></app-game-layout>
    </ng-container>

    <ng-template #showLogin>
      <app-login></app-login>
    </ng-template>
  `,
})
export class ShellComponent {
  auth = inject(AuthService);
}
