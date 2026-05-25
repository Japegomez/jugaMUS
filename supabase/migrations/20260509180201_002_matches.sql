CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  city TEXT NOT NULL,
  place_text TEXT,
  place_defined BOOLEAN NOT NULL DEFAULT TRUE,
  location_privacy TEXT NOT NULL DEFAULT 'public_city_only'
    CHECK (location_privacy IN ('public_city_only', 'participants_only')),
  duration_target_games INT NOT NULL CHECK (duration_target_games BETWEEN 1 AND 6),
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'link')),
  creator_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'finished', 'finished_no_result')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_matches_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_matches_updated_at();
