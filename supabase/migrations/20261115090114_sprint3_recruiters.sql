-- Sprint 3: recruiter accounts
-- A user who signs up with role = 'recruiter' gets a row here. Having a row
-- in this table is what makes an account a recruiter.

CREATE TABLE IF NOT EXISTS public.recruiters (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text,
  company_website text,
  company_description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_recruiters_updated_at ON public.recruiters;
CREATE TRIGGER set_recruiters_updated_at
  BEFORE UPDATE ON public.recruiters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- runs once when the account is created, so the role cannot be changed later
-- by editing the sign-up data
CREATE OR REPLACE FUNCTION public.handle_new_recruiter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.recruiters (id, company_name)
  VALUES (NEW.id, NULLIF(trim(NEW.raw_user_meta_data ->> 'company_name'), ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_recruiter_created ON auth.users;
CREATE TRIGGER on_auth_recruiter_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.raw_user_meta_data ->> 'role' = 'recruiter'
        OR NEW.raw_app_meta_data ->> 'role' = 'recruiter')
  EXECUTE FUNCTION public.handle_new_recruiter();

-- recruiter accounts that were set up by hand before this table existed
INSERT INTO public.recruiters (id)
SELECT u.id FROM auth.users AS u
WHERE u.raw_app_meta_data ->> 'role' = 'recruiter'
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.recruiters ENABLE ROW LEVEL SECURITY;

-- company info is shown on job postings, so any signed-in user can read it
DROP POLICY IF EXISTS recruiters_select ON public.recruiters;
CREATE POLICY recruiters_select
  ON public.recruiters FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS recruiters_update_own ON public.recruiters;
CREATE POLICY recruiters_update_own
  ON public.recruiters FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.recruiters FROM anon, authenticated;
GRANT SELECT ON TABLE public.recruiters TO authenticated;
GRANT UPDATE (company_name, company_website, company_description)
  ON TABLE public.recruiters TO authenticated;

-- posting a job: allowed for accounts in the recruiters table
-- (the old role check is kept so existing accounts keep working)
DROP POLICY IF EXISTS jobs_insert_own ON public.jobs;
CREATE POLICY jobs_insert_own
  ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (
    recruiter_id = (SELECT auth.uid())
    AND (
      EXISTS (SELECT 1 FROM public.recruiters AS r WHERE r.id = (SELECT auth.uid()))
      OR (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'recruiter'
    )
  );
