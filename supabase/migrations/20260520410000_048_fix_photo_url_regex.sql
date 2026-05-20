-- 048: Fix photo_url regex escaping from migration 045.

CREATE OR REPLACE FUNCTION public.validate_profile_photo_url()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.photo_url IS NULL OR BTRIM(NEW.photo_url) = '' THEN
    NEW.photo_url := NULL;
    RETURN NEW;
  END IF;

  IF NEW.photo_url !~ (
    '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/'
    || NEW.id::text
    || '\.jpg(\?.*)?$'
  ) THEN
    RAISE EXCEPTION 'invalid_photo_url';
  END IF;

  RETURN NEW;
END;
$$;
