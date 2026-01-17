import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, CdkDragMove } from '@angular/cdk/drag-drop';

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

  private subs: Subscription[] = [];

  // ===== Toast Capitán =====
  captainToastOpen = false;
  captainCandidates: Player[] = [];
  pendingCaptainAction: PendingCaptainAction | null = null;

  // ===== Toast Info =====
  infoToastOpen = false;
  infoToastTitle = '';
  infoToastMessage = '';

  // ✅ ID real del jugador del banquillo bajo el cursor durante drag
  hoveredBenchId: string | null = null;

  constructor(private db: SupabaseService) {}

  ngOnInit() {
    this.bench$ = this.db.bench$;
    this.onCourt$ = this.db.onCourt$;

    this.subs.push(
      this.db.selectedMatchId$.subscribe((id) => {
        this.matchId = id;
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach((s) => s.unsubscribe());
  }

  // trackBy para evitar reusos raros de DOM
  trackByPlayer = (_: number, p: Player) => p.id;
  trackByCourtSlot = (idx: number, p: Player | null) => (p ? p.id : `empty-${idx}`);

  // ==========================================================
  // HELPERS
  // ==========================================================

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

  private getCourtPlayers(court: (Player | null)[]) {
    return court.filter((p): p is Player => !!p);
  }

  private isLibero(p: Player | null | undefined) {
    return !!p && p.position === 'L';
  }

  /** ✅ Banquillo estable: líberos SIEMPRE a la izquierda sin ordenar por dorsal */
  private normalizeBenchStable(bench: Player[]) {
    const liberos: Player[] = [];
    const others: Player[] = [];
    for (const p of bench) (this.isLibero(p) ? liberos : others).push(p);
    return [...liberos, ...others];
  }

  private commitBench(nextBench: Player[]) {
    this.bench$.next(this.normalizeBenchStable(nextBench));
  }

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

  private isOnlyCaptainOnCourt(captain: Player, court: (Player | null)[]) {
    if (!captain.is_captain) return false;
    return !court.some((p) => p && p.id !== captain.id && p.is_captain);
  }

  // ==========================================================
  // TOAST CAPITÁN
  // ==========================================================

  private openCaptainToast(action: PendingCaptainAction) {
    if (action.type === 'benchToCourtSwap') {
      const remaining = this.getCourtPlayers(action.snapshotCourt).filter(
        (p) => p.id !== action.leavingCaptain.id
      );
      const list = [action.incoming, ...remaining];

      this.captainCandidates = list
        .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
        .filter((p) => !this.isLibero(p)); // ✅ líbero no puede ser capitán
    } else {
      this.captainCandidates = this.getCourtPlayers(action.snapshotCourt)
        .filter((p) => p.id !== action.leavingCaptain.id)
        .filter((p) => !this.isLibero(p));
    }

    if (this.captainCandidates.length === 0) {
      this.openInfoToast(
        'No permitido',
        'No hay jugadoras válidas para ser capitán (un líbero no puede).'
      );
      return;
    }

    this.pendingCaptainAction = action;
    this.captainToastOpen = true;
  }

  closeCaptainToast() {
    this.captainToastOpen = false;
    this.captainCandidates = [];
    this.pendingCaptainAction = null;
  }

  async chooseNewCaptainAndApply(newCaptain: Player) {
    // ✅ líbero no puede ser capitán
    if (this.isLibero(newCaptain)) {
      this.openInfoToast('No permitido', 'Un líbero no puede ser capitán.');
      return;
    }

    const action = this.pendingCaptainAction;
    if (!action) return;

    if (action.type === 'benchToCourtSwap') {
      const court = [...action.snapshotCourt];
      let bench = [...action.snapshotBench];

      const incomingIdx = bench.findIndex((x) => x.id === action.incoming.id);
      if (incomingIdx === -1) {
        this.closeCaptainToast();
        return;
      }

      // swap exacto: entra incoming, sale leavingCaptain al hueco del bench
      bench[incomingIdx] = action.leavingCaptain;
      court[action.posIndex] = action.incoming;

      this.onCourt$.next(court);
      this.commitBench(bench);

      await this.db.setCaptain(newCaptain.id);
      this.closeCaptainToast();
      return;
    }

    if (action.type === 'moveCaptainToBench') {
      const court = [...action.snapshotCourt];
      let bench = [...action.snapshotBench];

      const idx = court.findIndex((p) => p?.id === action.leavingCaptain.id);
      if (idx !== -1) court[idx] = null;

      bench.push(action.leavingCaptain);

      this.onCourt$.next(court);
      this.commitBench(bench);

      await this.db.setCaptain(newCaptain.id);
      this.closeCaptainToast();
      return;
    }
  }

  // ==========================================================
  // DETECCIÓN REAL DEL TARGET EN BANQUILLO (POR ID)
  // ==========================================================

  private getBenchIdUnderPointer(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;

    const item = el.closest('[data-bench-id]') as HTMLElement | null;
    if (!item) return null;

    return item.getAttribute('data-bench-id');
  }

  onDragMoved(ev: CdkDragMove<any>) {
    const { x, y } = ev.pointerPosition;
    this.hoveredBenchId = this.getBenchIdUnderPointer(x, y);
  }

  onDragEnded() {
    this.hoveredBenchId = null;
  }

  // ==========================================================
  // DRAG & DROP: CAMPO
  // ==========================================================

  dropToPosition(event: CdkDragDrop<any>, posIndex: number) {
    if (this.captainToastOpen || this.infoToastOpen) return;

    const court = [...this.onCourt$.value];
    let bench = [...this.bench$.value];

    const dragged: Player = event.item.data;
    if (!dragged) return;

    const fromCourtIdx = court.findIndex((p) => p?.id === dragged.id);
    const fromBenchIdx = bench.findIndex((p) => p.id === dragged.id);

    const target = court[posIndex];
    if (fromCourtIdx === posIndex) return;

    // ===== DESTINO OCUPADO => SWAP =====
    if (target) {
      // Campo -> Campo
      if (fromCourtIdx !== -1) {
        court[posIndex] = dragged;
        court[fromCourtIdx] = target;
        this.onCourt$.next(court);
        return;
      }

      // Bench -> Campo
      if (fromBenchIdx !== -1) {
        const incoming = bench[fromBenchIdx];

        // ❌ 2 líberos no
        if (
          this.wouldHaveTwoLiberosAfter({
            incoming,
            leavingFromCourt: target,
            courtSnapshot: court,
          })
        ) {
          this.openInfoToast('No permitido', 'No puede haber 2 líberos en el campo a la vez.');
          return;
        }

        // capitán único sale => toast
        const mustPickCaptain =
          target.is_captain && this.isOnlyCaptainOnCourt(target, court) && !incoming.is_captain;

        if (mustPickCaptain) {
          this.openCaptainToast({
            type: 'benchToCourtSwap',
            incoming,
            leavingCaptain: target,
            posIndex,
            snapshotCourt: [...this.onCourt$.value],
            snapshotBench: [...this.bench$.value],
          });
          return;
        }

        // ✅ swap exacto
        bench[fromBenchIdx] = target;
        court[posIndex] = incoming;

        this.onCourt$.next(court);
        this.commitBench(bench);
        return;
      }

      return;
    }

    // ===== DESTINO VACÍO => MOVER =====
    if (!target) {
      // Bench -> Campo
      if (fromBenchIdx !== -1) {
        const incoming = bench[fromBenchIdx];

        if (
          this.wouldHaveTwoLiberosAfter({
            incoming,
            leavingFromCourt: null,
            courtSnapshot: court,
          })
        ) {
          this.openInfoToast('No permitido', 'No puede haber 2 líberos en el campo a la vez.');
          return;
        }

        bench.splice(fromBenchIdx, 1);
        court[posIndex] = incoming;

        this.onCourt$.next(court);
        this.commitBench(bench);
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

  // ==========================================================
  // DRAG & DROP: BANQUILLO (SWAP EXACTO POR ID REAL BAJO CURSOR)
  // ==========================================================

  dropToBench(event: CdkDragDrop<any>) {
    if (this.captainToastOpen || this.infoToastOpen) return;

    const court = [...this.onCourt$.value];
    let bench = [...this.bench$.value];

    const dragged: Player = event.item.data;
    if (!dragged) return;

    const fromCourtIdx = court.findIndex((p) => p?.id === dragged.id);
    const fromBenchIdx = bench.findIndex((p) => p.id === dragged.id);

    // Bench -> Bench: no reorder (tu banquillo tiene reglas)
    if (fromBenchIdx !== -1 && fromCourtIdx === -1) {
      this.hoveredBenchId = null;
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
        this.hoveredBenchId = null;
        return;
      }

      // ✅ swap exacto con ficha REAL (ID real bajo cursor)
      const targetId = this.hoveredBenchId;
      const targetIdx = targetId ? bench.findIndex((p) => p.id === targetId) : -1;

      if (targetIdx !== -1) {
        const targetBench = bench[targetIdx];

        bench[targetIdx] = dragged;
        court[fromCourtIdx] = targetBench;

        this.onCourt$.next(court);
        this.commitBench(bench);
        this.hoveredBenchId = null;
        return;
      }

      // zona libre => al final
      court[fromCourtIdx] = null;
      bench.push(dragged);

      this.onCourt$.next(court);
      this.commitBench(bench);
      this.hoveredBenchId = null;
      return;
    }

    this.hoveredBenchId = null;
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
  // STATS PANEL
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
