-- Migration 060: avoid Apple Hide My Email relay prefix as display_name

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
BEGIN
  v_display_name := NULLIF(BTRIM(NEW.raw_user_meta_data->>'display_name'), '');
  IF v_display_name IS NULL THEN
    v_display_name := NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), '');
  END IF;

  IF v_display_name IS NULL THEN
    IF NEW.email IS NULL OR NEW.email = '' THEN
      v_display_name := 'Usuario';
    ELSIF NEW.email ILIKE '%@privaterelay.appleid.com' THEN
      v_display_name := 'Usuario';
    ELSE
      v_display_name := SPLIT_PART(NEW.email, '@', 1);
      IF LENGTH(BTRIM(v_display_name)) < 2 THEN
        v_display_name := 'Usuario';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, display_name, phone_e164)
  VALUES (
    NEW.id,
    v_display_name,
    COALESCE(NEW.raw_user_meta_data->>'phone_e164', '+34000000000')
  );
  RETURN NEW;
END;
$$;
