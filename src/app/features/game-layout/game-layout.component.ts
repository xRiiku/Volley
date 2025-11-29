import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminPanelComponent } from '../admin-panel/admin-panel.component';
import { CourtComponent } from '../court/court.component';
import { SupabaseService } from '../../core/supabase/supabase.service';

@Component({
  selector: 'app-game-layout',
  standalone: true,
  imports: [CommonModule, AdminPanelComponent, CourtComponent],
  templateUrl: './game-layout.component.html',
  styleUrls: ['./game-layout.component.scss'],
})
export class GameLayoutComponent {
  db = inject(SupabaseService);
}
