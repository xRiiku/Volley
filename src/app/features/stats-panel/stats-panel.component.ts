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
import {
  FormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Player } from '../../models/player.model';

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
  @Input() matchId!: string;

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['player'] || changes['matchId']) {
      if (this.open && this.player && this.matchId) {
        this.loadStats();
      }
    }
  }

  private async loadStats() {
    if (!this.player || !this.matchId) return;

    try {
      const stats = await this.db.getStatsForPlayerMatch(
        this.matchId,
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
      console.error('Error cargando estadísticas', err);
    }
  }

  async save() {
    if (!this.player || !this.matchId) return;

    const v = this.form.getRawValue();

    try {
      await this.db.saveStatsForPlayerMatch({
        matchId: this.matchId,
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

      this.close.emit();
    } catch (err) {
      console.error('Error guardando estadísticas', err);
    }
  }
}
