export type VolleyballPosition = 'S' | 'OH' | 'OPP' | 'MB' | 'L' | 'DS' | null;

export interface Player {
  id: string;
  number: number;
  name: string;
  position: VolleyballPosition;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}
