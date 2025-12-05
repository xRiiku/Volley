import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Player } from '../../models/player.model';

interface Season {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

interface Match {
  id: string;
  season_id: string;
  matchday: number;
  match_date: string;
  opponent: string;
  location: string;
  match_type: string;
  sets_for: number | null;
  sets_against: number | null;
}

interface PlayerSeasonSummary {
  player_id: string;
  player_name: string;
  player_number: number;
  season_id: string;
  season_name: string;
  total_points: number;
  total_aces: number;
  total_attacks: number;
  total_blocks: number;
  total_digs: number;
  total_receptions: number;
  total_assists: number;
  total_forced_errors: number;
  total_unforced_errors: number;
}

interface PlayerMatchHistoryItem {
  match_id: string;
  matchday: number;
  match_date: string;
  opponent: string;
  points: number;
  aces: number;
  attacks: number;
  blocks: number;
  digs: number;
  receptions: number;
  assists: number;
  forced_errors: number;
  unforced_errors: number;
}

@Component({
  selector: 'app-stats-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './stats-panel.component.html',
  styleUrls: ['./stats-panel.component.scss'],
})
export class StatsPanelComponent implements OnInit, OnChanges {
  @Input() open = false;
  @Input() player: Player | null = null;

  @Output() close = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private db = inject(SupabaseService);

  // Formulario de estadísticas del partido
  form = this.fb.nonNullable.group({
    points: 0,
    aces: 0,
    attacks: 0,
    blocks: 0,
    digs: 0,
    receptions: 0,
    assists: 0,
    forced_errors: 0,
    unforced_errors: 0,
  });

  // Selección de temporada / partido
  seasons: Season[] = [];
  matches: Match[] = [];
  selectedSeasonId: string | null = null;
  selectedMatchId: string | null = null;

  // Históricos
  seasonSummary: PlayerSeasonSummary | null = null;
  matchHistory: PlayerMatchHistoryItem[] = [];
  loadingSummary = false;
  summaryError = '';
  uiMessage = '';

  async ngOnInit() {
    await this.loadSeasons();

    // Intentar preseleccionar temporada actual
    if (this.seasons.length) {
      const current = this.seasons.find((s) => s.is_current);
      this.selectedSeasonId = current?.id ?? this.seasons[0].id;
      await this.onSeasonChange(this.selectedSeasonId);
    }
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if ((changes['open'] || changes['player']) && this.open && this.player) {
      this.uiMessage = '';

      // Si no hay temporadas aún, recargamos
      if (!this.seasons.length) {
        await this.loadSeasons();
      }

      if (this.selectedSeasonId) {
        await this.onSeasonChange(this.selectedSeasonId, false);
      }

      if (this.selectedMatchId) {
        await this.loadStats();
      } else {
        // si no hay partido seleccionado, limpiamos form
        this.resetStatsForm();
      }

      if (this.selectedSeasonId) {
        await this.loadHistory();
      }
    }
  }

  // ================== CARGA LISTAS ==================

  private async loadSeasons() {
    try {
      this.seasons = await this.db.getAllSeasonsForStats();
    } catch (err) {
      console.error('Error cargando temporadas para stats', err);
      this.seasons = [];
      this.uiMessage =
        'No se han podido cargar las temporadas. Revisa la conexión.';
    }
  }

  private async loadMatches(seasonId: string) {
    try {
      this.matches = await this.db.getMatchesBySeasonForStats(seasonId);
    } catch (err) {
      console.error('Error cargando partidos para stats', err);
      this.matches = [];
      this.uiMessage =
        'No se han podido cargar los partidos de la temporada seleccionada.';
    }
  }

  // ================== CAMBIOS DE SELECCIÓN ==================

  async onSeasonChange(seasonId: string | null, reloadHistory = true) {
    this.selectedSeasonId = seasonId;
    this.selectedMatchId = null;
    this.resetStatsForm();

    if (!seasonId) {
      this.matches = [];
      this.seasonSummary = null;
      this.matchHistory = [];
      this.uiMessage = 'Selecciona una temporada para ver estadísticas.';
      return;
    }

    await this.loadMatches(seasonId);

    if (reloadHistory && this.player) {
      await this.loadHistory();
    }
  }

  async onMatchChange(matchId: string | null) {
    this.selectedMatchId = matchId;
    if (!matchId) {
      this.resetStatsForm();
      this.uiMessage =
        'Selecciona un partido para ver o introducir estadísticas.';
      return;
    }

    await this.loadStats();
  }

  // ================== STATS DEL PARTIDO ==================

  private resetStatsForm() {
    this.form.reset({
      points: 0,
      aces: 0,
      attacks: 0,
      blocks: 0,
      digs: 0,
      receptions: 0,
      assists: 0,
      forced_errors: 0,
      unforced_errors: 0,
    });
  }

  private async loadStats() {
    if (!this.player || !this.selectedMatchId) return;

    try {
      const stats = await this.db.getStatsForPlayerMatch(
        this.selectedMatchId,
        this.player.id
      );

      if (stats) {
        this.form.setValue({
          points: stats.points,
          aces: stats.aces,
          attacks: stats.attacks,
          blocks: stats.blocks,
          digs: stats.digs,
          receptions: stats.receptions,
          assists: stats.assists,
          forced_errors: stats.forced_errors,
          unforced_errors: stats.unforced_errors,
        });
        this.uiMessage = '';
      } else {
        this.resetStatsForm();
        this.uiMessage =
          'No hay estadísticas guardadas todavía para este partido.';
      }
    } catch (err) {
      console.error('Error cargando estadísticas del partido', err);
      this.uiMessage = 'No se han podido cargar las estadísticas del partido.';
    }
  }

  async save() {
    if (!this.player) return;

    if (!this.selectedSeasonId || !this.selectedMatchId) {
      this.uiMessage =
        'Selecciona primero una temporada y un partido para guardar estadísticas.';
      return;
    }

    const v = this.form.getRawValue();

    try {
      await this.db.saveStatsForPlayerMatch({
        matchId: this.selectedMatchId,
        playerId: this.player.id,
        points: Number(v.points ?? 0),
        aces: Number(v.aces ?? 0),
        attacks: Number(v.attacks ?? 0),
        blocks: Number(v.blocks ?? 0),
        digs: Number(v.digs ?? 0),
        receptions: Number(v.receptions ?? 0),
        assists: Number(v.assists ?? 0),
        forced_errors: Number(v.forced_errors ?? 0),
        unforced_errors: Number(v.unforced_errors ?? 0),
      });

      await this.loadHistory();
      this.close.emit();
    } catch (err) {
      console.error('Error guardando estadísticas', err);
      this.uiMessage = 'No se han podido guardar las estadísticas.';
    }
  }

  // ================== HISTÓRICO (TEMPORADA SELECCIONADA) ==================

  private async loadHistory() {
    if (!this.player || !this.selectedSeasonId) return;

    this.loadingSummary = true;
    this.summaryError = '';

    try {
      const seasonsData = (await this.db.getPlayerStatsBySeason(
        this.player.id
      )) as PlayerSeasonSummary[];

      this.seasonSummary =
        seasonsData.find((s) => s.season_id === this.selectedSeasonId) ?? null;

      this.matchHistory =
        ((await this.db.getPlayerStatsByMatches(
          this.player.id,
          this.selectedSeasonId
        )) as PlayerMatchHistoryItem[]) ?? [];
    } catch (err) {
      console.error('Error cargando histórico de estadísticas', err);
      this.summaryError =
        'No se han podido cargar las estadísticas históricas.';
    } finally {
      this.loadingSummary = false;
    }
  }
}
