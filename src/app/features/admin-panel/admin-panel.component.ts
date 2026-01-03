import { AuthService } from '../../core/auth/auth.service';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Player } from '../../models/player.model';
import { Season } from '../../models/season.model';
import { Match } from '../../models/match.model';
import { Observable, combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.scss'],
})
export class AdminPanelComponent {
  // Inyección usando inject() para evitar el warning de "db usado antes de inicializar"
  private db = inject(SupabaseService);
  private fb = inject(FormBuilder);

  activeTab: 'players' | 'seasons' | 'matches' = 'players';

  players$: Observable<Player[]> = this.db.players$;
  seasons$: Observable<Season[]> = this.db.seasons$;
  matches$: Observable<Match[]> = this.db.matches$;

  /**
   * ✅ Partidos filtrados por la temporada seleccionada en matchForm.season_id
   * Esto es lo que usarás en la tabla para que no se mezclen temporadas.
   */
  filteredMatches$: Observable<Match[]>;

  // Formularios
  playerForm: FormGroup;
  seasonForm: FormGroup;
  matchForm: FormGroup;

  // Elementos en edición (null = creando nuevo)
  editingPlayer: Player | null = null;
  editingSeason: Season | null = null;
  editingMatch: Match | null = null;

  auth = inject(AuthService);

  async logout() {
    try {
      await this.auth.signOut();
    } catch (err) {
      console.error('Error al cerrar sesión', err);
    }
  }

  constructor() {
    this.playerForm = this.fb.group({
      number: [null, [Validators.required, Validators.min(1)]],
      name: ['', Validators.required],
      position: [null], // volleyball_position opcional
      notes: [null],
      is_active: [true],
    });

    this.seasonForm = this.fb.group({
      name: ['', Validators.required],
      start_date: [null],
      end_date: [null],
      is_current: [false],
    });

    this.matchForm = this.fb.group({
      season_id: ['', Validators.required],
      matchday: [1, [Validators.required, Validators.min(1)]],
      match_date: ['', Validators.required],
      opponent: ['', Validators.required],
      location: ['home', Validators.required],
      match_type: ['league', Validators.required],
      sets_for: [null],
      sets_against: [null],
      notes: [null],
    });

    // Observable del season_id seleccionado (incluye valor inicial)
    const selectedSeasonId$ = this.matchForm
      .get('season_id')!
      .valueChanges.pipe(startWith(this.matchForm.get('season_id')!.value));

    // ✅ Filtra los partidos por season_id seleccionado
    this.filteredMatches$ = combineLatest([this.matches$, selectedSeasonId$]).pipe(
      map(([matches, seasonId]) => {
        if (!seasonId) return [];
        return (matches ?? []).filter((m) => m.season_id === seasonId);
      })
    );
  }

  // =============================
  // TABS
  // =============================

  setTab(tab: 'players' | 'seasons' | 'matches') {
    this.activeTab = tab;
  }

  // =============================
  // JUGADORAS
  // =============================

  resetPlayerForm() {
    this.editingPlayer = null;
    this.playerForm.reset({
      number: null,
      name: '',
      position: null,
      notes: null,
      is_active: true,
    });
  }

  async submitPlayer() {
    if (this.playerForm.invalid) return;

    const value = this.playerForm.value;

    const payload = {
      number: Number(value.number),
      name: String(value.name),
      position: (value.position as string) || null,
      notes: (value.notes as string) || null,
      is_active: !!value.is_active,
    };

    try {
      if (this.editingPlayer) {
        await this.db.updatePlayer(this.editingPlayer.id, payload);
      } else {
        await this.db.createPlayer(payload);
      }
      this.resetPlayerForm();
    } catch (err) {
      console.error('Error guardando jugadora', err);
    }
  }

  editPlayer(p: Player) {
    this.editingPlayer = p;
    this.playerForm.setValue({
      number: p.number,
      name: p.name,
      position: p.position,
      notes: p.notes,
      is_active: p.is_active,
    });
  }

  async deletePlayer(p: Player) {
    if (!confirm(`¿Eliminar a ${p.name}?`)) return;
    try {
      await this.db.deletePlayer(p.id);
    } catch (err) {
      console.error('Error borrando jugadora', err);
    }
  }

  // =============================
  // TEMPORADAS
  // =============================

  resetSeasonForm() {
    this.editingSeason = null;
    this.seasonForm.reset({
      name: '',
      start_date: null,
      end_date: null,
      is_current: false,
    });
  }

  async submitSeason() {
    if (this.seasonForm.invalid) return;

    const value = this.seasonForm.value;

    const payload = {
      name: String(value.name),
      start_date: (value.start_date as string) || null,
      end_date: (value.end_date as string) || null,
      is_current: !!value.is_current,
    };

    try {
      if (this.editingSeason) {
        await this.db.updateSeason(this.editingSeason.id, payload);
      } else {
        await this.db.createSeason(payload);
      }
      this.resetSeasonForm();
    } catch (err) {
      console.error('Error guardando temporada', err);
    }
  }

  editSeason(s: Season) {
    this.editingSeason = s;
    this.seasonForm.setValue({
      name: s.name,
      start_date: s.start_date,
      end_date: s.end_date,
      is_current: s.is_current,
    });
  }

  async deleteSeason(s: Season) {
    if (!confirm(`¿Eliminar la temporada "${s.name}"?`)) return;
    try {
      await this.db.deleteSeason(s.id);
    } catch (err) {
      console.error('Error borrando temporada', err);
    }
  }

  // =============================
  // PARTIDOS
  // =============================

  resetMatchForm() {
    this.editingMatch = null;
    this.matchForm.reset({
      season_id: '',
      matchday: 1,
      match_date: '',
      opponent: '',
      location: 'home',
      match_type: 'league',
      sets_for: null,
      sets_against: null,
      notes: null,
    });
  }

  async submitMatch() {
    if (this.matchForm.invalid) return;

    const v = this.matchForm.value;

    const payload = {
      season_id: String(v.season_id),
      matchday: Number(v.matchday),
      opponent: String(v.opponent),
      match_date: String(v.match_date),
      location: String(v.location),
      match_type: String(v.match_type),
      sets_for:
        v.sets_for !== null && v.sets_for !== '' ? Number(v.sets_for) : null,
      sets_against:
        v.sets_against !== null && v.sets_against !== ''
          ? Number(v.sets_against)
          : null,
      notes: (v.notes as string) || null,
    };

    try {
      if (this.editingMatch) {
        await this.db.updateMatch(this.editingMatch.id, payload);
      } else {
        await this.db.createMatch(payload);
      }
      this.resetMatchForm();
    } catch (err) {
      console.error('Error guardando partido', err);
    }
  }

  editMatch(m: Match) {
    this.editingMatch = m;
    this.matchForm.setValue({
      season_id: m.season_id,
      matchday: m.matchday,
      match_date: m.match_date,
      opponent: m.opponent,
      location: m.location,
      match_type: m.match_type,
      sets_for: m.sets_for,
      sets_against: m.sets_against,
      notes: m.notes,
    });
  }

  async deleteMatch(m: Match) {
    if (!confirm(`¿Eliminar el partido contra ${m.opponent}?`)) return;
    try {
      await this.db.deleteMatch(m.id);
    } catch (err) {
      console.error('Error borrando partido', err);
    }
  }

  selectMatchAsCurrent(m: Match) {
    this.db.selectMatch(m.id);
  }
}
