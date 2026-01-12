export interface Referee {
  id: string;
  name: string;
  license_number: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}
