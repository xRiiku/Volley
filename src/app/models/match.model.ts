export type MatchLocation = 'home' | 'away' | 'neutral';
export type MatchType = 'league' | 'cup' | 'friendly' | 'other';

export interface Match {
  id: string;
  season_id: string;
  matchday: number;
  opponent: string;
  match_date: string; // 'YYYY-MM-DD'
  location: MatchLocation;
  match_type: MatchType;
  sets_for: number | null;
  sets_against: number | null;
  notes: string | null;
  referee_id: string | null;
  created_at: string;
}
