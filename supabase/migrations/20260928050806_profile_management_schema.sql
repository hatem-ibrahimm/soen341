BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Connect each public profile to one Supabase Authentication user.
-- ---------------------------------------------------------------------------

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    LEFT JOIN auth.users AS auth_user
      ON auth_user.id = profile.id
    WHERE auth_user.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Some existing profiles do not match auth.users. Correct those rows before applying this migration.';
  END IF;
END;
$migration$;

-- A profile ID must be given by the authenticated user

ALTER TABLE public.profiles
  ALTER COLUMN id DROP DEFAULT;

-- Add the foreign key only if the database does not already contain it.
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
      ON DELETE CASCADE;
  END IF;
END;
$migration$;

-- Create missing profiles for users who registered before this migration.
INSERT INTO public.profiles (
  id,
  first_name,
  last_name,
  email,
  created_at
)
SELECT
  auth_user.id,
  NULLIF(trim(auth_user.raw_user_meta_data ->> 'first_name'), ''),
  NULLIF(trim(auth_user.raw_user_meta_data ->> 'last_name'), ''),
  auth_user.email,
  COALESCE(auth_user.created_at, now())
FROM auth.users AS auth_user
ON CONFLICT (id) DO UPDATE
SET email = COALESCE(profiles.email, EXCLUDED.email);

-- ---------------------------------------------------------------------------
-- 2. Add thefields required by the Profile Management page.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone
    NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- 3. Create one to many profile tables.
-- ---------------------------------------------------------------------------

CREATE TABLE public.work_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_title text NOT NULL,
  company text NOT NULL,
  dates text,
  description text,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT work_experiences_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE
);

CREATE INDEX work_experiences_user_id_idx
  ON public.work_experiences (user_id);

CREATE TABLE public.education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  school text NOT NULL,
  degree text,
  years text,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT education_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE
);

CREATE INDEX education_user_id_idx
  ON public.education (user_id);

CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT skills_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE
);

CREATE INDEX skills_user_id_idx
  ON public.skills (user_id);

CREATE UNIQUE INDEX skills_user_name_key
  ON public.skills (user_id, lower(name));

-----------------------------------------------------------------------------
-- 4. Keep updated_at accurate automatically.
-----------------------------------------------------------------------------

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

CREATE TRIGGER set_work_experiences_updated_at
  BEFORE UPDATE ON public.work_experiences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_education_updated_at
  BEFORE UPDATE ON public.education
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-----------------------------------------------------------------------------
-- 5. Automatically create a profile when a user registers.
-----------------------------------------------------------------------------

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

-----------------------------------------------------------------------------
-- 6. Secure the profile tables with Row Level Security.
-----------------------------------------------------------------------------

ALTER TABLE public.work_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY work_experiences_manage_own
ON public.work_experiences
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY education_manage_own
ON public.education
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY skills_manage_own
ON public.skills
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.work_experiences
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.education
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.skills
TO authenticated;

COMMENT ON TABLE public.work_experiences IS
  'Work experience entries belonging to a user profile.';

COMMENT ON TABLE public.education IS
  'Education entries belonging to a user profile.';

COMMENT ON TABLE public.skills IS
  'Skills belonging to a user profile.';

COMMIT;
