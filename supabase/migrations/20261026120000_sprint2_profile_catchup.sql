-- ===========================================================================
-- Sprint 2 / Migration 1 of 3: profile catch-up
--
-- The live database (after 20261025203413) only has profiles(id, first_name,
-- last_name, email, created_at). This migration brings it back to what the
-- profile feature needs:
--   * profile columns (title, phone, location, bio, picture path, updated_at)
--   * the "create a profile when someone registers" trigger
--   * work_experiences, education, skills tables
--
-- Safe to run more than once, and safe whether or not
-- 20261025210000_restore_profile_management.sql was applied first.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Profile columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS bio text,
  -- used by the profile-picture endpoints: "<profile_id>/<random name>"
  ADD COLUMN IF NOT EXISTS profile_picture_path text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone
    NOT NULL DEFAULT now();

-- A profile id must always be the Supabase Auth user id, never random.
ALTER TABLE public.profiles
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Link every profile to its Supabase Auth user. NOT VALID = new rows are
-- checked, old rows are not (so a stray test row cannot block this migration).
-- To check the old rows too, run:
--   ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_id_fkey;
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END;
$migration$;

-- ---------------------------------------------------------------------------
-- 2. updated_at helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Create a profile automatically when someone registers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    created_at
  )
  VALUES (
    NEW.id,
    NULLIF(trim(NEW.raw_user_meta_data ->> 'first_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'last_name'), ''),
    NEW.email,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create profiles for anyone who registered while the trigger was missing.
INSERT INTO public.profiles (id, first_name, last_name, email, created_at)
SELECT
  u.id,
  NULLIF(trim(u.raw_user_meta_data ->> 'first_name'), ''),
  NULLIF(trim(u.raw_user_meta_data ->> 'last_name'), ''),
  u.email,
  COALESCE(u.created_at, now())
FROM auth.users AS u
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Work experience, education, skills
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.work_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_title text NOT NULL,
  company text NOT NULL,
  dates text,
  description text,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school text NOT NULL,
  degree text,
  years text,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Same owner-column name as resumes (profile_id). Only matters for a database
-- that still has the Sprint 1 tables (with user_id); a fresh one is already right.
DO $migration$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['work_experiences', 'education', 'skills'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = t
                 AND column_name = 'user_id') THEN
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN user_id TO profile_id', t);
    END IF;
  END LOOP;
END;
$migration$;

CREATE INDEX IF NOT EXISTS work_experiences_profile_id_idx
  ON public.work_experiences (profile_id);
CREATE INDEX IF NOT EXISTS education_profile_id_idx
  ON public.education (profile_id);
CREATE INDEX IF NOT EXISTS skills_profile_id_idx
  ON public.skills (profile_id);
-- the same skill cannot be added twice by one user (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS skills_profile_name_key
  ON public.skills (profile_id, lower(name));

DROP TRIGGER IF EXISTS set_work_experiences_updated_at ON public.work_experiences;
CREATE TRIGGER set_work_experiences_updated_at
  BEFORE UPDATE ON public.work_experiences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_education_updated_at ON public.education;
CREATE TRIGGER set_education_updated_at
  BEFORE UPDATE ON public.education
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row Level Security: each user manages only their own rows.
ALTER TABLE public.work_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_experiences_manage_own ON public.work_experiences;
CREATE POLICY work_experiences_manage_own
  ON public.work_experiences FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = profile_id)
  WITH CHECK ((SELECT auth.uid()) = profile_id);

DROP POLICY IF EXISTS education_manage_own ON public.education;
CREATE POLICY education_manage_own
  ON public.education FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = profile_id)
  WITH CHECK ((SELECT auth.uid()) = profile_id);

DROP POLICY IF EXISTS skills_manage_own ON public.skills;
CREATE POLICY skills_manage_own
  ON public.skills FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = profile_id)
  WITH CHECK ((SELECT auth.uid()) = profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.work_experiences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.education        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.skills           TO authenticated;

COMMENT ON TABLE public.work_experiences IS 'Work experience entries belonging to a user profile.';
COMMENT ON TABLE public.education        IS 'Education entries belonging to a user profile.';
COMMENT ON TABLE public.skills           IS 'Skills belonging to a user profile.';

COMMIT;
