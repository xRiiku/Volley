import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Player } from '../../models/player.model';

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
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './stats-panel.component.html',
  styleUrls: ['./stats-panel.component.scss'],
})
export class StatsPanelComponent implements OnChanges {
  @Input() open = false;
  @Input() player: Player | null = null;

  @Output() close = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private db = inject(SupabaseService);

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

  // Datos de consulta / histórico
  seasonSummary: PlayerSeasonSummary | null = null;
  matchHistory: PlayerMatchHistoryItem[] = [];
  loadingSummary = false;
  summaryError = '';
  uiMessage = ''; // para mostrar mensajes simples al usuario

  /** Partido actualmente seleccionado en la app */
  private get currentMatchId(): string | null {
    return this.db.selectedMatchId$.value;
  }

  /** Temporada actualmente seleccionada */
  private get currentSeasonId(): string | null {
    return this.db.selectedSeasonId$.value;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['player']) {
      if (this.open && this.player) {
        this.uiMessage = '';
        this.loadStats();
        this.loadHistory();
      }
    }
  }

  // ================== CARGA / GUARDADO DE STATS DEL PARTIDO ==================

  private async loadStats() {
    if (!this.player) return;

    const matchId = this.currentMatchId;
    if (!matchId) {
      // No hay partido seleccionado, limpiamos el form
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
      this.uiMessage =
        'Selecciona primero un partido en el panel para poder guardar estadísticas.';
      return;
    }

    try {
      const stats = await this.db.getStatsForPlayerMatch(
        matchId,
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
      } else {
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
    } catch (err) {
      console.error('Error cargando estadísticas del partido', err);
      this.uiMessage = 'No se han podido cargar las estadísticas del partido.';
    }
  }

  async save() {
    if (!this.player) return;

    const matchId = this.currentMatchId;
    if (!matchId) {
      this.uiMessage =
        'No hay ningún partido seleccionado. Ve al panel de administración y selecciona un partido para registrar estadísticas.';
      return;
    }

    const v = this.form.getRawValue();

    try {
      await this.db.saveStatsForPlayerMatch({
        matchId,
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

      // Tras guardar, recargamos el histórico
      await this.loadHistory();

      this.close.emit();
    } catch (err) {
      console.error('Error guardando estadísticas', err);
      this.uiMessage = 'No se han podido guardar las estadísticas.';
    }
  }

  // ================== HISTÓRICO (TEMPORADA ACTUAL) ==================

  private async loadHistory() {
    if (!this.player) return;

    const seasonId = this.currentSeasonId;
    if (!seasonId) {
      this.seasonSummary = null;
      this.matchHistory = [];
      return;
    }

    this.loadingSummary = true;
    this.summaryError = '';

    try {
      // Resumen por temporada (todas las temporadas de la jugadora)
      const seasonsData = (await this.db.getPlayerStatsBySeason(
        this.player.id
      )) as PlayerSeasonSummary[];

      this.seasonSummary =
        seasonsData.find((s) => s.season_id === seasonId) ?? null;

      // Historial de partidos de la temporada actual
      this.matchHistory =
        ((await this.db.getPlayerStatsByMatches(
          this.player.id,
          seasonId
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
