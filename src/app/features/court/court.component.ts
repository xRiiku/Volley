import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

import { SupabaseService } from '../../core/supabase/supabase.service';
import { Player } from '../../models/player.model';
import { PlayerChipComponent } from '../player-chip/player-chip.component';
import { StatsPanelComponent } from '../stats-panel/stats-panel.component';
import { BehaviorSubject, Subscription } from 'rxjs';

type PendingCaptainAction =
  | {
      type: 'benchToCourtSwap';
      incoming: Player;
      leavingCaptain: Player;
      posIndex: number;
      snapshotCourt: (Player | null)[];
      snapshotBench: Player[];
    }
  | {
      type: 'moveCaptainToBench';
      leavingCaptain: Player;
      snapshotCourt: (Player | null)[];
      snapshotBench: Player[];
    };

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

  // ✅ toast selector capitán
  captainToastOpen = false;
  captainCandidates: Player[] = [];
  pendingCaptainAction: PendingCaptainAction | null = null;

  private subs: Subscription[] = [];

  constructor(private db: SupabaseService) {}

  ngOnInit() {
    this.bench$ = this.db.bench$;
    this.onCourt$ = this.db.onCourt$;

    this.subs.push(
      this.db.selectedMatchId$.subscribe((id) => (this.matchId = id))
    );
  }

  ngOnDestroy() {
    this.subs.forEach((s) => s.unsubscribe());
  }

  // ==========================================================
  // HELPERS CAPITÁN
  // ==========================================================

  private getCourtPlayers(court: (Player | null)[]) {
    return court.filter((p): p is Player => !!p);
  }

  private isOnlyCaptainOnCourt(captain: Player, court: (Player | null)[]) {
    if (!captain.is_captain) return false;
    return !court.some((p) => p && p.id !== captain.id && p.is_captain);
  }

  private openCaptainToast(action: PendingCaptainAction) {
    if (action.type === 'benchToCourtSwap') {
      const remaining = this.getCourtPlayers(action.snapshotCourt).filter(
        (p) => p.id !== action.leavingCaptain.id
      );

      const list = [action.incoming, ...remaining];
      this.captainCandidates = list.filter(
        (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i
      );
    } else {
      this.captainCandidates = this.getCourtPlayers(action.snapshotCourt).filter(
        (p) => p.id !== action.leavingCaptain.id
      );
    }

    if (this.captainCandidates.length === 0) return;

    this.pendingCaptainAction = action;
    this.captainToastOpen = true;
  }

  closeCaptainToast() {
    this.captainToastOpen = false;
    this.captainCandidates = [];
    this.pendingCaptainAction = null;
  }

  /**
   * ✅ Importante: primero aplicamos el swap/move en memoria, luego setCaptain().
   * Así no se queda el hueco.
   */
  async chooseNewCaptainAndApply(newCaptain: Player) {
    const action = this.pendingCaptainAction;
    if (!action) return;

    if (action.type === 'benchToCourtSwap') {
      const court = [...action.snapshotCourt];
      const bench = [...action.snapshotBench];

      const incomingIdx = bench.findIndex((x) => x.id === action.incoming.id);
      if (incomingIdx !== -1) bench.splice(incomingIdx, 1);

      bench.push(action.leavingCaptain);
      court[action.posIndex] = action.incoming;

      this.onCourt$.next(court);
      this.bench$.next(bench);

      await this.db.setCaptain(newCaptain.id);
      this.closeCaptainToast();
      return;
    }

    if (action.type === 'moveCaptainToBench') {
      const court = [...action.snapshotCourt];
      const bench = [...action.snapshotBench];

      const idx = court.findIndex((p) => p?.id === action.leavingCaptain.id);
      if (idx !== -1) court[idx] = null;

      if (!bench.some((x) => x.id === action.leavingCaptain.id)) {
        bench.push(action.leavingCaptain);
      }

      this.onCourt$.next(court);
      this.bench$.next(bench);

      await this.db.setCaptain(newCaptain.id);
      this.closeCaptainToast();
      return;
    }
  }

  // ==========================================================
  // DRAG & DROP (SIMÉTRICO)
  // ==========================================================

  dropToPosition(event: CdkDragDrop<any>, posIndex: number) {
    if (this.captainToastOpen) return;

    const court = [...this.onCourt$.value];
    const bench = [...this.bench$.value];

    const dragged: Player = event.item.data;
    if (!dragged) return;

    const fromCourtIdx = court.findIndex((p) => p?.id === dragged.id);
    const fromBenchIdx = bench.findIndex((p) => p.id === dragged.id);

    const target = court[posIndex];

    // si suelta en la misma posición
    if (fromCourtIdx === posIndex) return;

    // DESTINO OCUPADO => SWAP
    if (target) {
      // Campo -> Campo (swap)
      if (fromCourtIdx !== -1) {
        court[posIndex] = dragged;
        court[fromCourtIdx] = target;
        this.onCourt$.next(court);
        return;
      }

      // Bench -> Campo (swap)
      if (fromBenchIdx !== -1) {
        const mustPickCaptain =
          target.is_captain &&
          this.isOnlyCaptainOnCourt(target, court) &&
          !dragged.is_captain;

        if (mustPickCaptain) {
          this.openCaptainToast({
            type: 'benchToCourtSwap',
            incoming: dragged,
            leavingCaptain: target,
            posIndex,
            snapshotCourt: [...this.onCourt$.value],
            snapshotBench: [...this.bench$.value],
          });
          return;
        }

        bench.splice(fromBenchIdx, 1);
        bench.push(target);
        court[posIndex] = dragged;

        this.bench$.next(bench);
        this.onCourt$.next(court);
        return;
      }

      return;
    }

    // DESTINO VACÍO => MOVER
    if (!target) {
      // Bench -> Campo
      if (fromBenchIdx !== -1) {
        bench.splice(fromBenchIdx, 1);
        court[posIndex] = dragged;

        this.bench$.next(bench);
        this.onCourt$.next(court);
        return;
      }

      // Campo -> hueco del campo
      if (fromCourtIdx !== -1) {
        court[fromCourtIdx] = null;
        court[posIndex] = dragged;

        this.onCourt$.next(court);
        return;
      }
    }
  }

  /**
   * ✅ Banquillo como dropList "real":
   * - Campo -> Banquillo: si sueltas encima de otra ficha => SWAP campo<->bench
   * - Campo -> Banquillo: si sueltas en contenedor => baja al final
   * - Bench -> Bench: reordenación (opcional, aquí lo dejo activado)
   */
  dropToBench(event: CdkDragDrop<any>) {
    if (this.captainToastOpen) return;

    const court = [...this.onCourt$.value];
    const bench = [...this.bench$.value];

    const dragged: Player = event.item.data;
    if (!dragged) return;

    const fromCourtIdx = court.findIndex((p) => p?.id === dragged.id);
    const fromBenchIdx = bench.findIndex((p) => p.id === dragged.id);

    // 1) Bench -> Bench (reordenar)
    if (fromBenchIdx !== -1 && fromCourtIdx === -1) {
      // si tu no quieres reordenar, borra esto y haz return;
      moveItemInArray(bench, fromBenchIdx, event.currentIndex);
      this.bench$.next(bench);
      return;
    }

    // 2) Campo -> Bench
    if (fromCourtIdx !== -1) {
      // Regla capitán
      if (dragged.is_captain && this.isOnlyCaptainOnCourt(dragged, court)) {
        this.openCaptainToast({
          type: 'moveCaptainToBench',
          leavingCaptain: dragged,
          snapshotCourt: [...this.onCourt$.value],
          snapshotBench: [...this.bench$.value],
        });
        return;
      }

      // Si el drop cae "encima" de una ficha del bench (currentIndex válido) => swap
      // Con grid funciona bien.
      const targetBench = bench[event.currentIndex];

      if (targetBench && targetBench.id !== dragged.id) {
        // swap campo <-> bench
        bench[event.currentIndex] = dragged;
        court[fromCourtIdx] = targetBench;

        this.bench$.next(bench);
        this.onCourt$.next(court);
        return;
      }

      // Si no hay target (suelto en hueco del contenedor) => baja al final
      court[fromCourtIdx] = null;
      bench.push(dragged);

      this.bench$.next(bench);
      this.onCourt$.next(court);
      return;
    }
  }

  // ==========================================================
  // ROTACIONES
  // ==========================================================

  rotateRight() {
    if (this.captainToastOpen) return;

    const court = [...this.onCourt$.value];
    const cycle = [1, 3, 5, 4, 2, 0];

    const last = court[cycle[cycle.length - 1]];
    for (let i = cycle.length - 1; i > 0; i--) {
      court[cycle[i]] = court[cycle[i - 1]];
    }
    court[cycle[0]] = last;

    this.onCourt$.next(court);
  }

  rotateLeft() {
    if (this.captainToastOpen) return;

    const court = [...this.onCourt$.value];
    const cycle = [1, 3, 5, 4, 2, 0];

    const first = court[cycle[0]];
    for (let i = 0; i < cycle.length - 1; i++) {
      court[cycle[i]] = court[cycle[i + 1]];
    }
    court[cycle[cycle.length - 1]] = first;

    this.onCourt$.next(court);
  }

  // ==========================================================
  // STATS
  // ==========================================================

  openStatsFor(p: Player) {
    if (this.captainToastOpen) return;
    this.selectedPlayer = p;
    this.openStats = true;
  }

  closeStats() {
    this.openStats = false;
    this.selectedPlayer = null;
  }
}
