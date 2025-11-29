import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Player } from '../../models/player.model';

@Component({
  selector: 'app-player-chip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player-chip.component.html',
  styleUrls: ['./player-chip.component.scss'],
})
export class PlayerChipComponent {
  @Input() player!: Player;
}
