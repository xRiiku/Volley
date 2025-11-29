import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';

import { SupabaseService } from '../../core/supabase/supabase.service';
import { Player } from '../../models/player.model';
import { PlayerChipComponent } from '../player-chip/player-chip.component';
import { StatsPanelComponent } from '../stats-panel/stats-panel.component';
import { BehaviorSubject, Subscription } from 'rxjs';

@Component({
  selector: 'app-court',
  standalone: true,
  imports: [CommonModule, DragDropModule, PlayerChipComponent, StatsPanelComponent],
  templateUrl: './court.component.html',
  styleUrls: ['./court.component.scss'],
})
export class CourtComponent implements OnInit, OnDestroy {
  bench$!: BehaviorSubject<Player[]>;
  onCourt$!: BehaviorSubject<(Player | null)[]>;

  openStats = false;
  selectedPlayer: Player | null = null;
  matchId: string | null = null;

  private subs: Subscription[] = [];

  constructor(private db: SupabaseService) {}

  ngOnInit() {
    this.bench$ = this.db.bench$;
    this.onCourt$ = this.db.onCourt$;

    this.subs.push(
      this.db.selectedMatchId$.subscribe(id => {
        this.matchId = id;
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  // ---------- DRAG & DROP ----------

  /**
   * Soltar una jugadora en una posición concreta de la pista (0..5)
   */
  dropToPosition(event: CdkDragDrop<any>, posIndex: number) {
    const court = [...this.onCourt$.value];
    const bench = [...this.bench$.value];
    const player: Player = event.item.data;

    if (!player) return;

    // Localizamos de dónde viene: banquillo o pista
    const fromBenchIdx = bench.findIndex(p => p.id === player.id);
    const fromCourtIdx = court.findIndex(p => p?.id === player.id);

    // Si viene del banquillo, la quitamos del banquillo
    if (fromBenchIdx !== -1) {
      bench.splice(fromBenchIdx, 1);
    }

    // Si viene de otra posición del campo, la vaciamos
    if (fromCourtIdx !== -1) {
      court[fromCourtIdx] = null;
    }

    // Si ya hay alguien en la posición destino, la mandamos al banquillo
    const existing = court[posIndex];
    if (existing) {
      bench.push(existing);
    }

    // Colocamos la jugadora en la nueva posición
    court[posIndex] = player;

    this.bench$.next(bench);
    this.onCourt$.next(court);
  }

  /**
   * Soltar una jugadora en el banquillo
   */
  dropToBench(event: CdkDragDrop<any>) {
    const court = [...this.onCourt$.value];
    const bench = [...this.bench$.value];
    const player: Player = event.item.data;

    if (!player) return;

    const fromBenchIdx = bench.findIndex(p => p.id === player.id);
    const fromCourtIdx = court.findIndex(p => p?.id === player.id);

    // Si estaba en pista, la quitamos
    if (fromCourtIdx !== -1) {
      court[fromCourtIdx] = null;
    }

    // Si no estaba ya en el banquillo, la añadimos
    if (fromBenchIdx === -1) {
      bench.push(player);
    }

    this.bench$.next(bench);
    this.onCourt$.next(court);
  }

  // ---------- ROTACIONES ----------

  /**
   * Rotar jugadoras como en vóley REAL (sentido horario)
   * Mapeo de índices:
   *  idx0 -> zona 4  (delante-izquierda)
   *  idx1 -> zona 3  (delante-centro)
   *  idx2 -> zona 2  (delante-derecha)
   *  idx3 -> zona 5  (atrás-izquierda)
   *  idx4 -> zona 6  (atrás-centro)
   *  idx5 -> zona 1  (atrás-derecha, zona de saque)
   *
   * Ciclo de rotación: 1→6→5→4→3→2→1  => índices [5,4,3,0,1,2]
   */
  rotateRight() {
    const court = [...this.onCourt$.value];
    const cycle = [5, 4, 3, 0, 1, 2];

    // Rotación sentido horario (clockwise)
    const last = court[cycle[cycle.length - 1]];
    for (let i = cycle.length - 1; i > 0; i--) {
      court[cycle[i]] = court[cycle[i - 1]];
    }
    court[cycle[0]] = last;

    this.onCourt$.next(court);
  }

  /**
   * Rotación en sentido contrario (antihorario)
   */
  rotateLeft() {
    const court = [...this.onCourt$.value];
    const cycle = [5, 4, 3, 0, 1, 2];

    const first = court[cycle[0]];
    for (let i = 0; i < cycle.length - 1; i++) {
      court[cycle[i]] = court[cycle[i + 1]];
    }
    court[cycle[cycle.length - 1]] = first;

    this.onCourt$.next(court);
  }

  // ---------- STATS PANEL ----------

  openStatsFor(p: Player) {
    this.selectedPlayer = p;
    this.openStats = true;
  }

  closeStats() {
    this.openStats = false;
    this.selectedPlayer = null;
  }
}
