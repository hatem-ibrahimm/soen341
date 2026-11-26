-- Fix three problems found by the acceptance tests on the online database.
--
-- 1. "infinite recursion detected in policy for relation applications":
-- applications_insert_own (20261123171000) reads resumes, and the resumes
-- policy for recruiters reads applications, so Postgres loops between them.
-- The resume ownership check now runs in a function that skips the resumes
-- policies, which breaks the loop. Same rule as before.

CREATE OR REPLACE FUNCTION public.owns_resume(p_resume_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resumes
    WHERE id = p_resume_id AND profile_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.owns_resume(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_resume(uuid) TO authenticated;

DROP POLICY IF EXISTS applications_insert_own ON public.applications;
CREATE POLICY applications_insert_own
  ON public.applications FOR INSERT TO authenticated
  WITH CHECK (
    applicant_id = (SELECT auth.uid())
    AND status = 'Applied'
    AND EXISTS (
      SELECT 1 FROM public.jobs AS j
      WHERE j.id = applications.job_id AND j.status = 'published'
    )
    AND (
      applications.resume_id IS NULL
      OR public.owns_resume(applications.resume_id)
    )
  );

-- 2. interviews_select (20261123171000) joins jobs, and job seekers cannot read
-- a posting once it is closed or archived, so they lost sight of their own
-- interviews. Back to: whoever can see the application can see its
-- interviews (the applicant, and the recruiter who owns the posting).
DROP POLICY IF EXISTS interviews_select ON public.interviews;
CREATE POLICY interviews_select
  ON public.interviews FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications AS a
      WHERE a.id = interviews.application_id
    )
  );

-- 3. handle_new_user was changed in the dashboard to also insert into
-- recruiters, without ON CONFLICT. handle_new_recruiter already does that, so
-- every recruiter sign-up failed with a duplicate key on recruiters_pkey.
-- Restore the version from 20261026120000_sprint2_profile_catchup.sql:
-- profiles only. Recruiter rows stay the job of handle_new_recruiter.
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
