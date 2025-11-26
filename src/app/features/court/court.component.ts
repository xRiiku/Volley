import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { BehaviorSubject } from 'rxjs';

import { PlayerChipComponent } from '../player-chip/player-chip.component';
import { StatsPanelComponent } from '../stats-panel/stats-panel.component';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Player } from '../../models/player.model';

@Component({
  selector: 'app-court',
  standalone: true,
  imports: [CommonModule, DragDropModule, PlayerChipComponent, StatsPanelComponent],
  templateUrl: './court.component.html',
  styleUrls: ['./court.component.scss']
})
export class CourtComponent implements OnInit, OnDestroy {
  teamId = 'TEAM-DEFAULT';
  matchId = 'MATCH-DEFAULT';

  openStats = false;
  selectedPlayer: Player | null = null;

  bench$!: BehaviorSubject<Player[]>;
  onCourt$!: BehaviorSubject<(Player | null)[]>;

  // 👇 ids de las listas de posiciones para conectar drag & drop
  positionIds = ['pos-0', 'pos-1', 'pos-2', 'pos-3', 'pos-4', 'pos-5'];

  private unsub: (() => void) | null = null;

  constructor(private db: SupabaseService) {}

  async ngOnInit() {
    this.bench$ = this.db.bench$;
    this.onCourt$ = this.db.onCourt$;

    await this.db.loadPlayers(this.teamId);
    this.unsub = this.db.subscribeStats(this.matchId, () => {});
  }

  ngOnDestroy() {
    if (this.unsub) this.unsub();
  }

  dropToPosition(event: CdkDragDrop<Player[]>, posIndex: number) {
    const bench = this.bench$.value;
    const court = [...this.onCourt$.value];

    if (event.previousContainer === event.container) return;

    const sourceData = event.previousContainer.data as Player[];
    const dragged = sourceData[event.previousIndex];

    // Si ya hay alguien en esa posición, vuelve al banquillo
    if (court[posIndex]) {
      bench.push(court[posIndex] as Player);
    }

    sourceData.splice(event.previousIndex, 1);
    court[posIndex] = dragged;

    this.bench$.next([...bench]);
    this.onCourt$.next([...court]);
  }

  removeFromPosition(posIndex: number) {
    const bench = this.bench$.value;
    const court = [...this.onCourt$.value];

    const p = court[posIndex];
    if (p) bench.push(p);

    court[posIndex] = null;

    this.bench$.next([...bench]);
    this.onCourt$.next([...court]);
  }

  openStatsFor(p: Player) {
    this.selectedPlayer = p;
    this.openStats = true;
  }
}
