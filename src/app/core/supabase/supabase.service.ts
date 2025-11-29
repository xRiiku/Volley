import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { supabase } from './supabase-client';

import { Player } from '../../models/player.model';
import { Season } from '../../models/season.model';
import { Match } from '../../models/match.model';
import { PlayerMatchStats } from '../../models/stats.model';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  // Estado compartido
  players$ = new BehaviorSubject<Player[]>([]);
  bench$ = new BehaviorSubject<Player[]>([]);
  onCourt$ = new BehaviorSubject<(Player | null)[]>([
    null, null, null, null, null, null
  ]);

  seasons$ = new BehaviorSubject<Season[]>([]);
  matches$ = new BehaviorSubject<Match[]>([]);
  selectedMatchId$ = new BehaviorSubject<string | null>(null);

  constructor() {}

  // -------- JUGADORAS --------
  async loadPlayers() {
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

  async createPlayer(payload: Partial<Player>) {
    const { data, error } = await supabase
      .from('players')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creando jugadora', error);
      return null;
    }
    await this.loadPlayers();
    return data as Player;
  }

  async updatePlayer(id: string, payload: Partial<Player>) {
    const { error } = await supabase
      .from('players')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('Error actualizando jugadora', error);
      return;
    }
    await this.loadPlayers();
  }

  async deletePlayer(id: string) {
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando jugadora', error);
      return;
    }
    await this.loadPlayers();
  }

  // -------- TEMPORADAS --------
  async loadSeasons() {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error cargando temporadas', error);
      return;
    }

    this.seasons$.next((data ?? []) as Season[]);
  }

  async createSeason(payload: Partial<Season>) {
    const { data, error } = await supabase
      .from('seasons')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creando temporada', error);
      return null;
    }
    await this.loadSeasons();
    return data as Season;
  }

  async updateSeason(id: string, payload: Partial<Season>) {
    const { error } = await supabase
      .from('seasons')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('Error actualizando temporada', error);
      return;
    }
    await this.loadSeasons();
  }

  async deleteSeason(id: string) {
    const { error } = await supabase
      .from('seasons')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando temporada', error);
      return;
    }
    await this.loadSeasons();
  }

  // -------- PARTIDOS --------
  async loadMatches(seasonId: string | null) {
    if (!seasonId) {
      this.matches$.next([]);
      this.selectedMatchId$.next(null);
      return;
    }

    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('season_id', seasonId)
      .order('matchday', { ascending: true });

    if (error) {
      console.error('Error cargando partidos', error);
      return;
    }

    const matches = (data ?? []) as Match[];
    this.matches$.next(matches);
    if (matches.length && !this.selectedMatchId$.value) {
      this.selectedMatchId$.next(matches[0].id);
    }
  }

  async createMatch(payload: Partial<Match>) {
    const { data, error } = await supabase
      .from('matches')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creando partido', error);
      return null;
    }
    await this.loadMatches(payload.season_id ?? null);
    return data as Match;
  }

  async updateMatch(id: string, payload: Partial<Match>) {
    const { error } = await supabase
      .from('matches')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('Error actualizando partido', error);
      return;
    }
    await this.loadMatches(payload.season_id ?? null);
  }

  async deleteMatch(id: string) {
    const current = this.matches$.value.find(m => m.id === id);
    const seasonId = current?.season_id ?? null;

    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando partido', error);
      return;
    }
    await this.loadMatches(seasonId);
  }

  // -------- STATS --------
  async upsertStats(stats: Partial<PlayerMatchStats>) {
    const { data, error } = await supabase
      .from('player_match_stats')
      .upsert(stats, { onConflict: 'match_id,player_id' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error guardando estadísticas', error);
      return null;
    }

    return data as PlayerMatchStats | null;
  }

  subscribeStats(matchId: string, cb: (row: PlayerMatchStats) => void) {
    // Lo dejamos preparado para Realtime en el futuro
    return () => {};
  }
}
