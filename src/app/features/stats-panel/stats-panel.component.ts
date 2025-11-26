import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Player } from '../../models/player.model';
import { SupabaseService } from '../../core/supabase/supabase.service';

@Component({
  selector: 'app-stats-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './stats-panel.component.html',
  styleUrls: ['./stats-panel.component.scss']
})
export class StatsPanelComponent {
  @Input() open = false;
  @Input() player!: Player;
  @Input() matchId!: string;
  @Output() close = new EventEmitter<void>();

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private db: SupabaseService
  ) {
    this.form = this.fb.group({
      points: [0],
      aces: [0],
      attacks: [0],
      blocks: [0],
      digs: [0],
      receptions: [0],
      assists: [0],
      forced_errors: [0],
      unforced_errors: [0],
    });
  }

  async save() {
    if (!this.player || !this.matchId) return;

    await this.db.upsertStats({
      match_id: this.matchId,
      player_id: this.player.id,
      ...this.form.value as any,
    });

    // cerrar al guardar:
    this.close.emit();
  }
}
