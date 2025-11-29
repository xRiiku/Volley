export interface Season {
  id: string;
  name: string;
  start_date: string | null; // 'YYYY-MM-DD'
  end_date: string | null;
  is_current: boolean;
  created_at: string;
}
