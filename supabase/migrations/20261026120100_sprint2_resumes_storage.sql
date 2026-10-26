-- ===========================================================================
-- Sprint 2 / Migration 2 of 3: resumes + storage buckets
--
-- The backend (app.py, "Resume management") expects:
--   resumes(id, profile_id, file_name, storage_path, content_type,
--           file_size, uploaded_at)      -- ONE resume per profile
-- The Sprint 1 table has the old shape:
--   resumes(id, user_id, file_name, file_path, created_at)
--
-- Safe to run more than once.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Rename old columns (keeps any existing data)
-- ---------------------------------------------------------------------------

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'resumes'
               AND column_name = 'user_id') THEN
    ALTER TABLE public.resumes RENAME COLUMN user_id TO profile_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'resumes'
               AND column_name = 'file_path') THEN
    ALTER TABLE public.resumes RENAME COLUMN file_path TO storage_path;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'resumes'
               AND column_name = 'created_at') THEN
    ALTER TABLE public.resumes RENAME COLUMN created_at TO uploaded_at;
  END IF;
END;
$migration$;

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS file_size bigint CHECK (file_size >= 0);

-- ---------------------------------------------------------------------------
-- 2. Fix the keys
-- ---------------------------------------------------------------------------

-- Sprint 1 tied resumes.id to profiles.id, which breaks every insert whose
-- id is a new random uuid. Remove it.
ALTER TABLE public.resumes
  DROP CONSTRAINT IF EXISTS resumes_id_fkey;

ALTER TABLE public.resumes
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN profile_id DROP DEFAULT,        -- was a random uuid
  ALTER COLUMN uploaded_at SET DEFAULT now(),
  ALTER COLUMN uploaded_at SET NOT NULL;

-- Rows without an owner are useless (and would block NOT NULL).
DELETE FROM public.resumes WHERE profile_id IS NULL;

ALTER TABLE public.resumes
  ALTER COLUMN profile_id SET NOT NULL;

-- One resume per profile (this matches POST = create, PUT = replace).
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.resumes
    GROUP BY profile_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Some profiles have more than one resume row. Delete the extras, then run this migration again.';
  END IF;
END;
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS resumes_profile_id_key
  ON public.resumes (profile_id);

-- NOT VALID: new rows are checked, existing rows are not.
-- Later: ALTER TABLE public.resumes VALIDATE CONSTRAINT resumes_profile_id_fkey;
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'resumes_profile_id_fkey'
      AND conrelid = 'public.resumes'::regclass
  ) THEN
    ALTER TABLE public.resumes
      ADD CONSTRAINT resumes_profile_id_fkey
      FOREIGN KEY (profile_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END;
$migration$;

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------
-- Existing policies keep working after the column rename (Postgres follows
-- the column). Only the DELETE policy was wrong: it was granted to
-- "authenticator" instead of "authenticated".

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User can delete their resume(s)" ON public.resumes;
CREATE POLICY "User can delete their resume(s)"
  ON public.resumes FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = profile_id);

COMMENT ON COLUMN public.resumes.storage_path IS
  'Path inside the "resumes" storage bucket: <profile_id>/<random>.<ext>';

-- ---------------------------------------------------------------------------
-- 4. Storage buckets (private) + per-user folder rules
-- ---------------------------------------------------------------------------
-- Files live at "<profile_id>/<random name>", which the backend builds.
--
-- A brand-new local Supabase can apply migrations BEFORE its storage service
-- has created the storage tables. In that case this block does nothing, and
-- the buckets are created from supabase/config.toml instead ([storage.buckets.*]).
-- Either way the same two private buckets end up existing.

DO $storage$
BEGIN
  IF to_regclass('storage.buckets') IS NULL
     OR to_regclass('storage.objects') IS NULL THEN
    RAISE NOTICE 'storage schema not ready yet: buckets will be created from supabase/config.toml';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'resumes', 'resumes', false,
    10485760,  -- 10 MB, same as RESUME_MAX_SIZE in app.py
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
  ON CONFLICT (id) DO UPDATE
    SET file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'profile-pictures', 'profile-pictures', false,
    2097152,  -- 2 MB, same as MAX_PICTURE_SIZE in app.py
    ARRAY['image/jpeg', 'image/png']
  )
  ON CONFLICT (id) DO UPDATE
    SET file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

  -- A logged-in user may only touch files inside their own folder.
  -- (The Flask backend uses the service-role key for storage, which skips
  -- these rules; they protect the buckets if anything else talks to them.)
  EXECUTE 'DROP POLICY IF EXISTS "own folder: resumes" ON storage.objects';
  EXECUTE $p$
    CREATE POLICY "own folder: resumes"
      ON storage.objects FOR ALL TO authenticated
      USING (
        bucket_id = 'resumes'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      )
      WITH CHECK (
        bucket_id = 'resumes'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      )
  $p$;

  EXECUTE 'DROP POLICY IF EXISTS "own folder: profile-pictures" ON storage.objects';
  EXECUTE $p$
    CREATE POLICY "own folder: profile-pictures"
      ON storage.objects FOR ALL TO authenticated
      USING (
        bucket_id = 'profile-pictures'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      )
      WITH CHECK (
        bucket_id = 'profile-pictures'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
      )
  $p$;
END;
$storage$;

COMMIT;
