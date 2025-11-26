import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { supabase } from './supabase-client';
import { environment } from '../../../environments/environments';

import { Player } from '../../models/player.model';
import { PlayerMatchStats } from '../../models/stats.model';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  players$ = new BehaviorSubject<Player[]>([]);
  bench$ = new BehaviorSubject<Player[]>([]);
  onCourt$ = new BehaviorSubject<(Player | null)[]>([
    null, null, null, null, null, null
  ]);

  constructor() {}

  /**
   * Carga todas las jugadoras activas (un solo equipo interno)
   */
  async loadPlayers(): Promise<void> {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('is_active', true)
      .order('number', { ascending: true });

    if (error) {
      console.error('Error cargando jugadoras', error);
      return;
    }

    const players = (data ?? []) as Player[];
    this.players$.next(players);
    this.bench$.next(players);
    this.onCourt$.next([null, null, null, null, null, null]);
  }

  /**
   * Guarda / actualiza stats de una jugadora en un partido
   */
  async upsertStats(stats: Partial<PlayerMatchStats>) {
    const payload = {
      ...stats,
    };

    const { data, error } = await supabase
      .from('player_match_stats')
      .upsert(payload, { onConflict: 'match_id,player_id' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error guardando estadísticas', error);
      return null;
    }

    return data as PlayerMatchStats | null;
  }

  /**
   * Placeholder para futuro realtime de stats
   */
  subscribeStats(matchId: string, cb: (row: PlayerMatchStats) => void) {
    // En el futuro podemos conectar Supabase Realtime
    return () => {};
  }
}
