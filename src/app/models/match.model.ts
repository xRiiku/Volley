export interface Match {
  id: string;          // uuid
  season: string;      // '2025-26'
  jornada: number;     // 1..n
  opponent: string;
  date: string;        // ISO
}
