BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone
    NOT NULL DEFAULT now();

ALTER TABLE public.profiles
  ALTER COLUMN id DROP DEFAULT;

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
      'Some profiles do not match auth.users. Correct those rows before applying this migration.';
  END IF;
END;
$migration$;

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
ON CONFLICT (id) DO NOTHING;

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

COMMIT;