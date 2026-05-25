-- Migration 015: customizable team display names (default Equipo A / Equipo B).

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS team_a_name TEXT NOT NULL DEFAULT 'Equipo A',
  ADD COLUMN IF NOT EXISTS team_b_name TEXT NOT NULL DEFAULT 'Equipo B';
