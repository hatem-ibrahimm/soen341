-- Sprint 3: line the recruiters table up with the one created in the dashboard
-- The dashboard version also has full_name and role_title, and required
-- full_name and company_name. Sign-up creates the row automatically, so those
-- two can no longer be required (a missing value would block the sign-up).

ALTER TABLE public.recruiters ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.recruiters ADD COLUMN IF NOT EXISTS role_title text DEFAULT 'Recruiter';
ALTER TABLE public.recruiters ALTER COLUMN full_name DROP NOT NULL;
ALTER TABLE public.recruiters ALTER COLUMN company_name DROP NOT NULL;

-- make sure the row is tied to the account and removed with it
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.recruiters'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.recruiters DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.recruiters
  ADD CONSTRAINT recruiters_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- sign-up now also fills in the recruiter's name
CREATE OR REPLACE FUNCTION public.handle_new_recruiter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.recruiters (id, full_name, company_name)
  VALUES (
    NEW.id,
    NULLIF(trim(concat_ws(' ', NEW.raw_user_meta_data ->> 'first_name',
                               NEW.raw_user_meta_data ->> 'last_name')), ''),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'company_name'), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

GRANT UPDATE (full_name, role_title) ON TABLE public.recruiters TO authenticated;
