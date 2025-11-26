export interface Match {
  id: string;
  season_id: string;
  matchday: number;
  opponent: string;
  match_date: string; // ISO YYYY-MM-DD
  location: 'home' | 'away' | 'neutral';
  match_type: 'league' | 'cup' | 'friendly' | 'other';
  sets_for?: number | null;
  sets_against?: number | null;
  notes?: string | null;
  created_at: string;
}
