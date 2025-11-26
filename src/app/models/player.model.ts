export interface Player {
  id: string;
  number: number;
  name: string;
  position?: 'S' | 'OH' | 'OPP' | 'MB' | 'L' | 'DS' | string;
  is_active: boolean;
  notes?: string | null;
  created_at?: string;
}
