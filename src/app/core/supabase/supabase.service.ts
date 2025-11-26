import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Player } from '../../models/player.model';
import { PlayerMatchStats } from '../../models/stats.model';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  players$ = new BehaviorSubject<Player[]>([]);
  bench$ = new BehaviorSubject<Player[]>([]);
  onCourt$ = new BehaviorSubject<(Player | null)[]>([
    null,
    null,
    null,
    null,
    null,
    null,
  ]);

  constructor() {
    // 👇 Mock temporal para que la app siempre tenga jugadoras
    const mock: Player[] = [
      { id: '1', name: 'Paula', number: 1 },
      { id: '2', name: 'Lucía', number: 3 },
      { id: '3', name: 'María', number: 5 },
      { id: '4', name: 'Ana', number: 7 },
      { id: '5', name: 'Laura', number: 9 },
      { id: '6', name: 'Irene', number: 11 },
      { id: '7', name: 'Sara', number: 13 },
    ];
    this.players$.next(mock);
    this.bench$.next(mock);
  }

  // De momento NO llamamos a Supabase, solo resolvemos la promesa
  async loadPlayers(teamId: string) {
    return;
  }

  async upsertStats(stats: Partial<PlayerMatchStats>) {
    console.log('Mock save stats', stats);
    return null;
  }

  subscribeStats(matchId: string, cb: (row: PlayerMatchStats) => void) {
    // Devuelve simplemente una función vacío para no romper nada
    return () => {};
  }
}
