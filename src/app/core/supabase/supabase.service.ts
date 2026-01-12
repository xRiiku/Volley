import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { supabase } from './supabase-client';
import { Player } from '../../models/player.model';
import { Season } from '../../models/season.model';
import { Match } from '../../models/match.model';
import { PlayerMatchStats } from '../../models/stats.model';

export interface Referee {
  id: string;
  name: string;
  license_number: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  // Estado principal
  players$ = new BehaviorSubject<Player[]>([]);
  seasons$ = new BehaviorSubject<Season[]>([]);
  matches$ = new BehaviorSubject<Match[]>([]);
  referees$ = new BehaviorSubject<Referee[]>([]); // ✅ NUEVO

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
    await this.loadReferees(); // ✅ NUEVO

    // Si hay temporada actual, la seleccionamos
    const currentSeason = this.seasons$.value.find((s) => s.is_current);
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
    const players = this.players$.value.filter((p) => p.is_active);
    const onCourtIds = this.onCourt$.value
      .filter((p) => p !== null)
      .map((p) => (p as Player).id);

    const bench = players.filter((p) => !onCourtIds.includes(p.id));
    this.bench$.next(bench);
  }

  private findPlayerById(id: string): Player | undefined {
    return this.players$.value.find((p) => p.id === id);
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

    this.players$.next((data ?? []) as Player[]);
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

    this.seasons$.next((data ?? []) as Season[]);
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

    this.matches$.next((data ?? []) as Match[]);
  }

  // ✅ NUEVO
  async loadReferees() {
    const { data, error } = await supabase
      .from('referees')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error cargando árbitros', error);
      return;
    }

    this.referees$.next((data ?? []) as Referee[]);
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
    position: string | null;
    notes?: string | null;
    is_active?: boolean;
    is_captain?: boolean;
  }) {
    const { data, error } = await supabase
      .from('players')
      .insert({
        number: payload.number,
        name: payload.name,
        position: payload.position,
        notes: payload.notes ?? null,
        ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
        is_captain: false, // ✅ siempre false al crear
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creando jugadora', error);
      throw error;
    }

    // si debe ser capitana, lo hacemos bien
    if (payload.is_captain && data?.id) {
      await this.setCaptain(data.id);
      return;
    }

    await this.loadPlayers();
  }

  async updatePlayer(
    id: string,
    payload: {
      number?: number;
      name?: string;
      position?: string | null;
      notes?: string | null;
      is_active?: boolean;
      is_captain?: boolean;
    }
  ) {
    // Si viene is_captain=true, usamos el flujo seguro
    if (payload.is_captain === true) {
      // primero actualiza el resto de campos (sin is_captain)
      const updateData: any = {};
      if (payload.number !== undefined) updateData.number = payload.number;
      if (payload.name !== undefined) updateData.name = payload.name;
      if (payload.position !== undefined) updateData.position = payload.position;
      if (payload.notes !== undefined) updateData.notes = payload.notes ?? null;
      if (payload.is_active !== undefined) updateData.is_active = payload.is_active;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase.from('players').update(updateData).eq('id', id);
        if (error) {
          console.error('Error actualizando jugadora', error);
          throw error;
        }
      }

      // luego asigna capitana bien
      await this.setCaptain(id);
      return;
    }

    // Caso normal: update simple
    const updateData: any = {};
    if (payload.number !== undefined) updateData.number = payload.number;
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.position !== undefined) updateData.position = payload.position;
    if (payload.notes !== undefined) updateData.notes = payload.notes ?? null;
    if (payload.is_active !== undefined) updateData.is_active = payload.is_active;
    if (payload.is_captain !== undefined) updateData.is_captain = payload.is_captain;

    const { error } = await supabase.from('players').update(updateData).eq('id', id);

    if (error) {
      console.error('Error actualizando jugadora', error);
      throw error;
    }

    await this.loadPlayers();
  }

  /** En lugar de borrar, marcamos como inactiva para conservar historial */
  async deletePlayer(id: string) {
    const { error } = await supabase.from('players').update({ is_active: false }).eq('id', id);

    if (error) {
      console.error('Error marcando jugadora inactiva', error);
      throw error;
    }

    // La sacamos de la pista en memoria
    const court = this.onCourt$.value.map((p) => (p && p.id === id ? null : p));
    this.onCourt$.next(court);

    await this.loadPlayers();
  }

  // ✅ NUEVO: asignar capitán desde UI asegurando solo 1
  async setCaptain(playerId: string) {
    // 1) quitar capitán actual (solo a las que estén en true)
    const { error: errReset } = await supabase
      .from('players')
      .update({ is_captain: false })
      .eq('is_captain', true);

    if (errReset) {
      console.error('Error reseteando capitanes', errReset);
      throw errReset;
    }

    // 2) asignar nueva capitana
    const { error: errSet } = await supabase
      .from('players')
      .update({ is_captain: true })
      .eq('id', playerId);

    if (errSet) {
      console.error('Error asignando capitán', errSet);
      throw errSet;
    }

    await this.loadPlayers();
  }

  // helper interno por si se marca capitán al crear/editar
  private async ensureSingleCaptain(exceptId?: string) {
    // deja a true solo la última marcada; el resto false
    // Si no pasas exceptId, no hace nada seguro; por eso lo usamos con id.
    if (!exceptId) return;

    const { error } = await supabase
      .from('players')
      .update({ is_captain: false })
      .neq('id', exceptId)
      .eq('is_captain', true);

    if (error) {
      console.error('Error asegurando capitán único', error);
      // no lanzamos para no romper UX, pero puedes cambiarlo a throw si prefieres
    }
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
    if (payload.is_current) {
      await supabase.from('seasons').update({ is_current: false }).eq('is_current', true);
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

  async updateSeason(
    id: string,
    payload: {
      name: string;
      start_date?: string | null;
      end_date?: string | null;
      is_current?: boolean;
    }
  ) {
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
    referee_id?: string | null; // ✅ NUEVO
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
      referee_id: payload.referee_id ?? null, // ✅ NUEVO
      notes: payload.notes ?? null,
    });

    if (error) {
      console.error('Error creando partido', error);
      throw error;
    }

    await this.loadMatchesForSeason(payload.season_id);
  }

  async updateMatch(
    id: string,
    payload: {
      season_id: string;
      matchday: number;
      opponent: string;
      match_date: string;
      location: string;
      match_type: string;
      sets_for?: number | null;
      sets_against?: number | null;
      referee_id?: string | null; // ✅ NUEVO
      notes?: string | null;
    }
  ) {
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
        referee_id: payload.referee_id ?? null, // ✅ NUEVO
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
    const match = this.matches$.value.find((m) => m.id === id);
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

  async getStatsForPlayerMatch(matchId: string, playerId: string): Promise<PlayerMatchStats | null> {
    const { data, error } = await supabase
      .from('player_match_stats')
      .select('*')
      .eq('match_id', matchId)
      .eq('player_id', playerId)
      .maybeSingle();

    if (error && (error as any).code !== 'PGRST116') {
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
        { onConflict: 'match_id,player_id' }
      );

    if (error) {
      console.error('Error guardando stats', error);
      throw error;
    }
  }

  // ================== HISTÓRICO DE ESTADÍSTICAS ==================

  async getPlayerStatsByMatches(playerId: string, seasonId: string) {
    const { data, error } = await supabase
      .from('v_player_stats_by_match')
      .select('*')
      .eq('player_id', playerId)
      .eq('season_id', seasonId)
      .order('matchday', { ascending: true });

    if (error) {
      console.error('Error obteniendo stats por partido', error);
      throw error;
    }

    return data;
  }

  async getPlayerStatsBySeason(playerId: string) {
    const { data, error } = await supabase
      .from('v_player_stats_by_season')
      .select('*')
      .eq('player_id', playerId)
      .order('season_name', { ascending: true });

    if (error) {
      console.error('Error obteniendo stats por temporada', error);
      throw error;
    }

    return data;
  }

  async getAllSeasonsForStats() {
    const { data, error } = await supabase
      .from('seasons')
      .select('id, name, start_date, end_date, is_current')
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error getAllSeasonsForStats', error);
      throw error;
    }

    return data ?? [];
  }

  async getMatchesBySeasonForStats(seasonId: string) {
    const { data, error } = await supabase
      .from('matches')
      .select(
        'id, season_id, matchday, match_date, opponent, location, match_type, sets_for, sets_against, referee_id'
      )
      .eq('season_id', seasonId)
      .order('matchday', { ascending: true });

    if (error) {
      console.error('Error getMatchesBySeasonForStats', error);
      throw error;
    }

    return data ?? [];
  }

  // ========================================
// CRUD ÁRBITROS (referees)
// ========================================

async createReferee(payload: {
  name: string;
  license_number?: string | null;
  notes?: string | null;
  is_active?: boolean;
}) {
  const { error } = await supabase.from('referees').insert({
    name: payload.name,
    license_number: payload.license_number ?? null,
    notes: payload.notes ?? null,
    is_active: payload.is_active ?? true,
  });

  if (error) {
    console.error('Error creando árbitro', error);
    throw error;
  }

  await this.loadReferees();
}

async updateReferee(
  id: string,
  payload: {
    name: string;
    license_number?: string | null;
    notes?: string | null;
    is_active?: boolean;
  }
) {
  const { error } = await supabase
    .from('referees')
    .update({
      name: payload.name,
      license_number: payload.license_number ?? null,
      notes: payload.notes ?? null,
      ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
    })
    .eq('id', id);

  if (error) {
    console.error('Error actualizando árbitro', error);
    throw error;
  }

  await this.loadReferees();
}

async deleteReferee(id: string) {
  const { error } = await supabase.from('referees').delete().eq('id', id);

  if (error) {
    console.error('Error borrando árbitro', error);
    throw error;
  }

  await this.loadReferees();
}

}
