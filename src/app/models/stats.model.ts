export interface PlayerMatchStats {
  id: string;           // uuid
  match_id: string;     // FK Match
  player_id: string;    // FK Player
  // Métricas básicas de vóley a tiempo real:
  points: number;
  aces: number;
  serve_errors: number;
  attacks: number;
  kills: number;
  attack_errors: number;
  blocks: number;
  block_errors: number;
  digs: number;
  receptions: number;
  reception_errors: number;
  assists: number;
  set_errors: number;
  // Puedes ampliar luego con rotaciones/eficiencias.
  updated_at: string;   // ISO
}
