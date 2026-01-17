// court.component.ts
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

  // ✅ Toast capitán
  captainToastOpen = false;
  captainCandidates: Player[] = [];
  pendingCaptainAction: PendingCaptainAction | null = null;

  // ✅ Toast info (p.ej. 2 líberos)
  infoToastOpen = false;
  infoToastTitle = '';
  infoToastMessage = '';

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
  // HELPERS / TOASTS
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

  private openInfoToast(title: string, message: string) {
    this.infoToastTitle = title;
    this.infoToastMessage = message;
    this.infoToastOpen = true;
  }

  closeInfoToast() {
    this.infoToastOpen = false;
    this.infoToastTitle = '';
    this.infoToastMessage = '';
  }

  // ==========================================================
  // REGLA LIBEROS
  // ==========================================================

  private isLibero(p: Player | null | undefined) {
    return !!p && p.position === 'L';
  }

  /**
   * Si entra un líbero al campo:
   * - si ya hay 1 líbero en pista y la que sale NO es líbero => quedaría 2 (bloquear)
   * - si la que sale es líbero => ok (se mantiene 1)
   */
  private wouldHaveTwoLiberosAfter(params: {
    incoming: Player;
    leavingFromCourt?: Player | null;
    courtSnapshot: (Player | null)[];
  }) {
    if (!this.isLibero(params.incoming)) return false;

    const liberoCountNow = params.courtSnapshot.reduce(
      (acc, x) => acc + (this.isLibero(x) ? 1 : 0),
      0
    );

    const leavingIsLibero = this.isLibero(params.leavingFromCourt);
    return liberoCountNow >= 1 && !leavingIsLibero;
  }

  // ==========================================================
  // CAPITAN: aplicar acción pendiente + setCaptain
  // ==========================================================

  async chooseNewCaptainAndApply(newCaptain: Player) {
    const action = this.pendingCaptainAction;
    if (!action) return;

    // 1) Aplicar swap/move en memoria primero
    if (action.type === 'benchToCourtSwap') {
      const court = [...action.snapshotCourt];
      const bench = [...action.snapshotBench];

      const incomingIdx = bench.findIndex((x) => x.id === action.incoming.id);
      if (incomingIdx !== -1) bench.splice(incomingIdx, 1);

      bench.push(action.leavingCaptain);
      court[action.posIndex] = action.incoming;

      this.onCourt$.next(court);
      this.bench$.next(bench);

      // 2) luego capitán en BD
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
  // DRAG & DROP (SIMETRICO + VALIDACION LIBERO)
  // ==========================================================

  dropToPosition(event: CdkDragDrop<any>, posIndex: number) {
    if (this.captainToastOpen || this.infoToastOpen) return;

    const court = [...this.onCourt$.value];
    const bench = [...this.bench$.value];

    const dragged: Player = event.item.data;
    if (!dragged) return;

    const fromCourtIdx = court.findIndex((p) => p?.id === dragged.id);
    const fromBenchIdx = bench.findIndex((p) => p.id === dragged.id);

    const target = court[posIndex];

    // misma posición
    if (fromCourtIdx === posIndex) return;

    // =========================
    // DESTINO OCUPADO => SWAP
    // =========================
    if (target) {
      // Campo -> Campo
      if (fromCourtIdx !== -1) {
        // (no cambia nº de líberos)
        court[posIndex] = dragged;
        court[fromCourtIdx] = target;
        this.onCourt$.next(court);
        return;
      }

      // Bench -> Campo
      if (fromBenchIdx !== -1) {
        // ✅ regla líbero
        if (
          this.wouldHaveTwoLiberosAfter({
            incoming: dragged,
            leavingFromCourt: target,
            courtSnapshot: court,
          })
        ) {
          this.openInfoToast(
            'No permitido',
            'No puede haber 2 líberos en el campo a la vez.'
          );
          return;
        }

        // ✅ regla capitán (si el que sale era capitán único y el que entra no lo es)
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

        // swap normal
        bench.splice(fromBenchIdx, 1);
        bench.push(target);
        court[posIndex] = dragged;

        this.bench$.next(bench);
        this.onCourt$.next(court);
        return;
      }

      return;
    }

    // =========================
    // DESTINO VACIO => MOVER
    // =========================
    if (!target) {
      // Bench -> Campo
      if (fromBenchIdx !== -1) {
        // ✅ regla líbero
        if (
          this.wouldHaveTwoLiberosAfter({
            incoming: dragged,
            leavingFromCourt: null,
            courtSnapshot: court,
          })
        ) {
          this.openInfoToast(
            'No permitido',
            'No puede haber 2 líberos en el campo a la vez.'
          );
          return;
        }

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

  dropToBench(event: CdkDragDrop<any>) {
    if (this.captainToastOpen || this.infoToastOpen) return;

    const court = [...this.onCourt$.value];
    const bench = [...this.bench$.value];

    const dragged: Player = event.item.data;
    if (!dragged) return;

    const fromCourtIdx = court.findIndex((p) => p?.id === dragged.id);
    const fromBenchIdx = bench.findIndex((p) => p.id === dragged.id);

    // Bench -> Bench (reordenar)
    if (fromBenchIdx !== -1 && fromCourtIdx === -1) {
      moveItemInArray(bench, fromBenchIdx, event.currentIndex);
      this.bench$.next(bench);
      return;
    }

    // Campo -> Bench
    if (fromCourtIdx !== -1) {
      // capitán único => toast
      if (dragged.is_captain && this.isOnlyCaptainOnCourt(dragged, court)) {
        this.openCaptainToast({
          type: 'moveCaptainToBench',
          leavingCaptain: dragged,
          snapshotCourt: [...this.onCourt$.value],
          snapshotBench: [...this.bench$.value],
        });
        return;
      }

      // swap si cae sobre una ficha del bench (grid => índice fiable)
      const targetBench = bench[event.currentIndex];
      if (targetBench && targetBench.id !== dragged.id) {
        // ✅ regla líbero NO aplica aquí (sale del campo)
        bench[event.currentIndex] = dragged;
        court[fromCourtIdx] = targetBench;

        this.bench$.next(bench);
        this.onCourt$.next(court);
        return;
      }

      // si cae en hueco del contenedor -> baja al final
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
    if (this.captainToastOpen || this.infoToastOpen) return;

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
    if (this.captainToastOpen || this.infoToastOpen) return;

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
    if (this.captainToastOpen || this.infoToastOpen) return;
    this.selectedPlayer = p;
    this.openStats = true;
  }

  closeStats() {
    this.openStats = false;
    this.selectedPlayer = null;
  }
}
