import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CourtComponent } from '../court/court.component';
import { AdminPanelComponent } from '../admin-panel/admin-panel.component';
import { SupabaseService } from '../../core/supabase/supabase.service';

@Component({
  selector: 'app-game-layout',
  standalone: true,
  imports: [CommonModule, CourtComponent, AdminPanelComponent],
  templateUrl: './game-layout.component.html',
  styleUrls: ['./game-layout.component.scss'],
})
export class GameLayoutComponent implements OnInit {
  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    await this.db.loadPlayers();
    await this.db.loadSeasons();
    const currentSeason =
      this.db.seasons$.value.find(s => s.is_current) ?? this.db.seasons$.value[0] ?? null;
    if (currentSeason) {
      await this.db.loadMatches(currentSeason.id);
    }
  }
}
