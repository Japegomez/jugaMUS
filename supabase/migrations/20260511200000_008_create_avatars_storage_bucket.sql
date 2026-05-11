-- Migration 008: Create avatars storage bucket with RLS policies
-- Bucket is public (read) but write/delete restricted to own file.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 524288, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_public_read'
  ) THEN
    EXECUTE 'CREATE POLICY avatars_public_read ON storage.objects FOR SELECT TO public USING (bucket_id = ''avatars'')';
  END IF;
END $$;

-- Authenticated upload (own file only: {userId}.jpg)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_upload_own'
  ) THEN
    EXECUTE 'CREATE POLICY avatars_upload_own ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''avatars'' AND name = (auth.uid()::text || ''.jpg''))';
  END IF;
END $$;

-- Authenticated update (own file)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_update_own'
  ) THEN
    EXECUTE 'CREATE POLICY avatars_update_own ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = ''avatars'' AND name = (auth.uid()::text || ''.jpg''))';
  END IF;
END $$;

-- Authenticated delete (own file)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_delete_own'
  ) THEN
    EXECUTE 'CREATE POLICY avatars_delete_own ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''avatars'' AND name = (auth.uid()::text || ''.jpg''))';
  END IF;
END $$;
