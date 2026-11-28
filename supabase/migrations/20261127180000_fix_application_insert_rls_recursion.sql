CREATE OR REPLACE FUNCTION public.application_resume_is_owned(p_resume_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resumes AS r
    WHERE r.id = p_resume_id
      AND r.profile_id = (SELECT auth.uid())
  )
$$;

REVOKE ALL ON FUNCTION public.application_resume_is_owned(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.application_resume_is_owned(uuid) TO authenticated;

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
      OR public.application_resume_is_owned(applications.resume_id)
    )
  );
