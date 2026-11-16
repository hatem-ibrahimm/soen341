-- Sprint 3: recruiter dashboard and posting management

-- recruiters can archive a posting (hidden from search, kept for their records)
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('draft', 'published', 'closed', 'archived'));

-- applications received per posting, filtered by status or sorted by date
CREATE INDEX IF NOT EXISTS applications_job_status_idx
  ON public.applications (job_id, status);
CREATE INDEX IF NOT EXISTS applications_job_created_idx
  ON public.applications (job_id, created_at DESC);

-- reviewing candidates: a recruiter can see the profile and the submitted
-- resume of anyone who applied to one of their postings
DROP POLICY IF EXISTS profiles_select_applicants ON public.profiles;
CREATE POLICY profiles_select_applicants
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications AS a
      JOIN public.jobs AS j ON j.id = a.job_id
      WHERE a.applicant_id = profiles.id
        AND j.recruiter_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS resumes_select_applicants ON public.resumes;
CREATE POLICY resumes_select_applicants
  ON public.resumes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications AS a
      JOIN public.jobs AS j ON j.id = a.job_id
      WHERE a.resume_id = resumes.id
        AND j.recruiter_id = (SELECT auth.uid())
    )
  );
