import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { supabase } from './supabase-client';
import { Player } from '../../models/player.model';
import { Season } from '../../models/season.model';
import { Match } from '../../models/match.model';
import { PlayerMatchStats } from '../../models/stats.model';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  // Estado principal
  players$ = new BehaviorSubject<Player[]>([]);
  seasons$ = new BehaviorSubject<Season[]>([]);
  matches$ = new BehaviorSubject<Match[]>([]);

  // Tablero
  bench$ = new BehaviorSubject<Player[]>([]);
  onCourt$ = new BehaviorSubject<(Player | null)[]>([
    null,
    null,
    null,
    null,
    null,
    null,
  ]);

  // Selecciones actuales
  selectedSeasonId$ = new BehaviorSubject<string | null>(null);
  selectedMatchId$ = new BehaviorSubject<string | null>(null);

  constructor() {
    this.init();
  }

  // ========================================
  // INIT
  // ========================================

  private async init() {
    await this.loadPlayers();
    await this.loadSeasons();

    // Si hay temporada actual, la seleccionamos
    const currentSeason = this.seasons$.value.find(s => s.is_current);
    if (currentSeason) {
      await this.selectSeason(currentSeason.id);
    }

    // Banquillo inicial = todas las jugadoras activas
    this.resetBenchFromPlayers();
  }

  // ========================================
  // HELPERS
  // ========================================

  private resetBenchFromPlayers() {
    const players = this.players$.value.filter(p => p.is_active);
    const onCourtIds = this.onCourt$.value
      .filter(p => p !== null)
      .map(p => (p as Player).id);

    const bench = players.filter(p => !onCourtIds.includes(p.id));
    this.bench$.next(bench);
  }

  private findPlayerById(id: string): Player | undefined {
    return this.players$.value.find(p => p.id === id);
  }

  // ========================================
  // LOADERS
  // ========================================

  async loadPlayers() {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('number', { ascending: true });

    if (error) {
      console.error('Error cargando jugadoras', error);
      return;
    }

    this.players$.next(data as Player[]);
    this.resetBenchFromPlayers();
  }

  async loadSeasons() {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error cargando temporadas', error);
      return;
    }

    this.seasons$.next(data as Season[]);
  }

  async loadMatchesForSeason(seasonId: string) {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('season_id', seasonId)
      .order('matchday', { ascending: true });

    if (error) {
      console.error('Error cargando partidos', error);
      return;
    }

    this.matches$.next(data as Match[]);
  }

  // ========================================
  // SELECCIÓN TEMPORADA / PARTIDO
  // ========================================

  async selectSeason(seasonId: string) {
    this.selectedSeasonId$.next(seasonId);
    await this.loadMatchesForSeason(seasonId);

    // Al cambiar de temporada, no forzamos partido por defecto.
    this.selectedMatchId$.next(null);
  }

  selectMatch(matchId: string | null) {
    this.selectedMatchId$.next(matchId);
  }

  // ========================================
  // CRUD JUGADORAS
  // ========================================

  async createPlayer(payload: {
    number: number;
    name: string;
    position?: string | null;
    notes?: string | null;
    is_active?: boolean;
  }) {
    const { error } = await supabase.from('players').insert({
      number: payload.number,
      name: payload.name,
      position: payload.position ?? null,
      notes: payload.notes ?? null,
      is_active: payload.is_active ?? true,
    });

    if (error) {
      console.error('Error creando jugadora', error);
      throw error;
    }

    await this.loadPlayers();
  }

  async updatePlayer(id: string, payload: {
    number: number;
    name: string;
    position?: string | null;
    notes?: string | null;
    is_active?: boolean;
  }) {
    const { error } = await supabase
      .from('players')
      .update({
        number: payload.number,
        name: payload.name,
        position: payload.position ?? null,
        notes: payload.notes ?? null,
        is_active: payload.is_active ?? true,
      })
      .eq('id', id);

    if (error) {
      console.error('Error actualizando jugadora', error);
      throw error;
    }

    await this.loadPlayers();
  }

  async deletePlayer(id: string) {
    const { error } = await supabase.from('players').delete().eq('id', id);

    if (error) {
      console.error('Error borrando jugadora', error);
      throw error;
    }

    // quitamos también de onCourt y bench en memoria
    const court = this.onCourt$.value.map(p =>
      p && p.id === id ? null : p
    );
    this.onCourt$.next(court);

    await this.loadPlayers();
  }

  // ========================================
  // CRUD TEMPORADAS
  // ========================================

  async createSeason(payload: {
    name: string;
    start_date?: string | null;
    end_date?: string | null;
    is_current?: boolean;
  }) {
    // Si marcamos como actual, desmarcamos otras
    if (payload.is_current) {
      await supabase
        .from('seasons')
        .update({ is_current: false })
        .eq('is_current', true);
    }

    const { error } = await supabase.from('seasons').insert({
      name: payload.name,
      start_date: payload.start_date ?? null,
      end_date: payload.end_date ?? null,
      is_current: payload.is_current ?? false,
    });

    if (error) {
      console.error('Error creando temporada', error);
      throw error;
    }

    await this.loadSeasons();
  }

  async updateSeason(id: string, payload: {
    name: string;
    start_date?: string | null;
    end_date?: string | null;
    is_current?: boolean;
  }) {
    if (payload.is_current) {
      await supabase
        .from('seasons')
        .update({ is_current: false })
        .eq('is_current', true)
        .neq('id', id);
    }

    const { error } = await supabase
      .from('seasons')
      .update({
        name: payload.name,
        start_date: payload.start_date ?? null,
        end_date: payload.end_date ?? null,
        is_current: payload.is_current ?? false,
      })
      .eq('id', id);

    if (error) {
      console.error('Error actualizando temporada', error);
      throw error;
    }

    await this.loadSeasons();
  }

  async deleteSeason(id: string) {
    const { error } = await supabase.from('seasons').delete().eq('id', id);

    if (error) {
      console.error('Error borrando temporada', error);
      throw error;
    }

    // Si la temporada seleccionada es esta, la des-seleccionamos
    if (this.selectedSeasonId$.value === id) {
      this.selectedSeasonId$.next(null);
      this.matches$.next([]);
      this.selectedMatchId$.next(null);
    }

    await this.loadSeasons();
  }

  // ========================================
  // CRUD PARTIDOS
  // ========================================

  async createMatch(payload: {
    season_id: string;
    matchday: number;
    opponent: string;
    match_date: string;
    location: string;
    match_type: string;
    sets_for?: number | null;
    sets_against?: number | null;
    notes?: string | null;
  }) {
    const { error } = await supabase.from('matches').insert({
      season_id: payload.season_id,
      matchday: payload.matchday,
      opponent: payload.opponent,
      match_date: payload.match_date,
      location: payload.location,
      match_type: payload.match_type,
      sets_for: payload.sets_for ?? null,
      sets_against: payload.sets_against ?? null,
      notes: payload.notes ?? null,
    });

    if (error) {
      console.error('Error creando partido', error);
      throw error;
    }

    await this.loadMatchesForSeason(payload.season_id);
  }

  async updateMatch(id: string, payload: {
    season_id: string;
    matchday: number;
    opponent: string;
    match_date: string;
    location: string;
    match_type: string;
    sets_for?: number | null;
    sets_against?: number | null;
    notes?: string | null;
  }) {
    const { error } = await supabase
      .from('matches')
      .update({
        season_id: payload.season_id,
        matchday: payload.matchday,
        opponent: payload.opponent,
        match_date: payload.match_date,
        location: payload.location,
        match_type: payload.match_type,
        sets_for: payload.sets_for ?? null,
        sets_against: payload.sets_against ?? null,
        notes: payload.notes ?? null,
      })
      .eq('id', id);

    if (error) {
      console.error('Error actualizando partido', error);
      throw error;
    }

    await this.loadMatchesForSeason(payload.season_id);
  }

  async deleteMatch(id: string) {
    const match = this.matches$.value.find(m => m.id === id);
    const seasonId = match?.season_id ?? this.selectedSeasonId$.value;

    const { error } = await supabase.from('matches').delete().eq('id', id);

    if (error) {
      console.error('Error borrando partido', error);
      throw error;
    }

    if (seasonId) {
      await this.loadMatchesForSeason(seasonId);
    }

    if (this.selectedMatchId$.value === id) {
      this.selectedMatchId$.next(null);
    }
  }

  // ========================================
  // ESTADÍSTICAS (player_match_stats)
  // ========================================

  async getStatsForPlayerMatch(
    matchId: string,
    playerId: string
  ): Promise<PlayerMatchStats | null> {
    const { data, error } = await supabase
      .from('player_match_stats')
      .select('*')
      .eq('match_id', matchId)
      .eq('player_id', playerId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows
      console.error('Error obteniendo stats', error);
      throw error;
    }

    return (data as PlayerMatchStats) ?? null;
  }

  async saveStatsForPlayerMatch(params: {
    matchId: string;
    playerId: string;
    points: number;
    aces: number;
    attacks: number;
    blocks: number;
    digs: number;
    receptions: number;
    assists: number;
    forced_errors: number;
    unforced_errors: number;
  }) {
    const { error } = await supabase
      .from('player_match_stats')
      .upsert(
        {
          match_id: params.matchId,
          player_id: params.playerId,
          points: params.points,
          aces: params.aces,
          attacks: params.attacks,
          blocks: params.blocks,
          digs: params.digs,
          receptions: params.receptions,
          assists: params.assists,
          forced_errors: params.forced_errors,
          unforced_errors: params.unforced_errors,
        },
        {
          onConflict: 'match_id,player_id',
        }
      );

    if (error) {
      console.error('Error guardando stats', error);
      throw error;
    }
  }
}
