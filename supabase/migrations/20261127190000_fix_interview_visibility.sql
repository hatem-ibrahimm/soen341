CREATE OR REPLACE FUNCTION public.can_access_interview(p_application_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.applications AS a
    JOIN public.jobs AS j ON j.id = a.job_id
    WHERE a.id = p_application_id
      AND (
        a.applicant_id = (SELECT auth.uid())
        OR j.recruiter_id = (SELECT auth.uid())
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_access_interview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_interview(uuid) TO authenticated;

DROP POLICY IF EXISTS interviews_select ON public.interviews;
CREATE POLICY interviews_select
  ON public.interviews FOR SELECT TO authenticated
  USING (public.can_access_interview(application_id));
