-- Align direct Supabase Data API permissions with backend ownership checks.
BEGIN;

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
      OR EXISTS (
        SELECT 1
        FROM public.resumes AS r
        WHERE r.id = applications.resume_id
          AND r.profile_id = (SELECT auth.uid())
      )
    )
  );

REVOKE UPDATE ON TABLE public.applications FROM authenticated;
GRANT UPDATE (status) ON TABLE public.applications TO authenticated;

DROP POLICY IF EXISTS interviews_select ON public.interviews;
CREATE POLICY interviews_select
  ON public.interviews FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications AS a
      JOIN public.jobs AS j ON j.id = a.job_id
      WHERE a.id = interviews.application_id
        AND (
          a.applicant_id = (SELECT auth.uid())
          OR j.recruiter_id = (SELECT auth.uid())
        )
    )
  );

COMMIT;
