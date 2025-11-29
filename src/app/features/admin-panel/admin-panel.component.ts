import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Player } from '../../models/player.model';
import { Season } from '../../models/season.model';
import { Match } from '../../models/match.model';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss'],
})
export class AdminPanelComponent {
  activeTab: 'players' | 'seasons' | 'matches' = 'players';

  // ⬇️ en lugar de fields, usamos getters
  get players$() {
    return this.db.players$;
  }

  get seasons$() {
    return this.db.seasons$;
  }

  get matches$() {
    return this.db.matches$;
  }

  get selectedMatchId$() {
    return this.db.selectedMatchId$;
  }

  playerForm: FormGroup;
  editingPlayer: Player | null = null;

  seasonForm: FormGroup;
  editingSeason: Season | null = null;

  matchForm: FormGroup;
  editingMatch: Match | null = null;
  selectedSeasonId: string | null = null;

  constructor(private db: SupabaseService, private fb: FormBuilder) {
    // Jugadora
    this.playerForm = this.fb.group({
      number: [0],
      name: [''],
      position: [''],
      notes: [''],
      is_active: [true],
    });

    // Temporada
    this.seasonForm = this.fb.group({
      name: [''],
      start_date: [''],
      end_date: [''],
      is_current: [false],
    });

    // Partido
    this.matchForm = this.fb.group({
      season_id: [''],
      matchday: [1],
      opponent: [''],
      match_date: [''],
      location: ['home'],
      match_type: ['league'],
      sets_for: [null],
      sets_against: [null],
      notes: [''],
    });
  }

  // ---------- TABS ----------
  setTab(tab: 'players' | 'seasons' | 'matches') {
    this.activeTab = tab;
  }

  // ---------- CRUD JUGADORAS ----------
  editPlayer(p: Player) {
    this.editingPlayer = p;
    this.playerForm.patchValue({
      number: p.number,
      name: p.name,
      position: p.position ?? '',
      notes: p.notes ?? '',
      is_active: p.is_active,
    });
  }

  resetPlayerForm() {
    this.editingPlayer = null;
    this.playerForm.reset({
      number: 0,
      name: '',
      position: '',
      notes: '',
      is_active: true,
    });
  }

  async submitPlayer() {
    const value = this.playerForm.value;
    if (this.editingPlayer) {
      await this.db.updatePlayer(this.editingPlayer.id, value);
    } else {
      await this.db.createPlayer(value);
    }
    this.resetPlayerForm();
  }

  async deletePlayer(p: Player) {
    if (!confirm(`¿Eliminar a ${p.name}?`)) return;
    await this.db.deletePlayer(p.id);
  }

  // ---------- CRUD TEMPORADAS ----------
  editSeason(s: Season) {
    this.editingSeason = s;
    this.seasonForm.patchValue({
      name: s.name,
      start_date: s.start_date ?? '',
      end_date: s.end_date ?? '',
      is_current: s.is_current,
    });
  }

  resetSeasonForm() {
    this.editingSeason = null;
    this.seasonForm.reset({
      name: '',
      start_date: '',
      end_date: '',
      is_current: false,
    });
  }

  async submitSeason() {
    const value = this.seasonForm.value;
    if (this.editingSeason) {
      await this.db.updateSeason(this.editingSeason.id, value);
    } else {
      await this.db.createSeason(value);
    }
    this.resetSeasonForm();
    await this.db.loadSeasons();
  }

  async deleteSeason(s: Season) {
    if (!confirm(`¿Eliminar temporada ${s.name}?`)) return;
    await this.db.deleteSeason(s.id);
  }

  async selectSeasonForMatches(seasonId: string) {
    this.selectedSeasonId = seasonId;
    await this.db.loadMatches(seasonId);
    this.matchForm.patchValue({ season_id: seasonId });
  }

  // ---------- CRUD PARTIDOS ----------
  editMatch(m: Match) {
    this.editingMatch = m;
    this.matchForm.patchValue({
      season_id: m.season_id,
      matchday: m.matchday,
      opponent: m.opponent,
      match_date: m.match_date,
      location: m.location,
      match_type: m.match_type,
      sets_for: m.sets_for,
      sets_against: m.sets_against,
      notes: m.notes ?? '',
    });
  }

  resetMatchForm() {
    this.editingMatch = null;
    this.matchForm.reset({
      season_id: this.selectedSeasonId ?? '',
      matchday: 1,
      opponent: '',
      match_date: '',
      location: 'home',
      match_type: 'league',
      sets_for: null,
      sets_against: null,
      notes: '',
    });
  }

  async submitMatch() {
    const value = this.matchForm.value;
    if (!value.season_id) {
      alert('Selecciona una temporada para el partido.');
      return;
    }

    if (this.editingMatch) {
      await this.db.updateMatch(this.editingMatch.id, value);
    } else {
      await this.db.createMatch(value);
    }
    this.resetMatchForm();
    await this.db.loadMatches(value.season_id);
  }

  async deleteMatch(m: Match) {
    if (!confirm(`¿Eliminar partido contra ${m.opponent}?`)) return;
    await this.db.deleteMatch(m.id);
  }

  selectMatchAsCurrent(m: Match) {
    this.db.selectedMatchId$.next(m.id);
  }
}
