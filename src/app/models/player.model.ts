export interface Player {
  id: string;          // uuid
  name: string;
  number: number;      // dorsal
  role?: 'OH'|'MB'|'OPP'|'S'|'L'|'DS'|string; // opcional
}
