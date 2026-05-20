-- 045: Whitelist profile photo_url to the project's avatars bucket only.

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

DROP TRIGGER IF EXISTS trg_validate_profile_photo_url ON public.profiles;
CREATE TRIGGER trg_validate_profile_photo_url
  BEFORE INSERT OR UPDATE OF photo_url ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_photo_url();
