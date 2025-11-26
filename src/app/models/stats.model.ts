export interface PlayerMatchStats {
  id: number;
  match_id: string;
  player_id: string;

  points: number;
  aces: number;
  attacks: number;
  blocks: number;
  digs: number;
  receptions: number;
  assists: number;

  forced_errors: number;
  unforced_errors: number;

  created_at: string;
  updated_at: string;
}
