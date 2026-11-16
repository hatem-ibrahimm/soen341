-- Sprint 3: reminders (application deadlines and interview invitations)

-- a posting can have a last day to apply
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS application_deadline date;

CREATE INDEX IF NOT EXISTS jobs_deadline_idx
  ON public.jobs (application_deadline) WHERE status = 'published';

-- an interview a recruiter schedules for one application
CREATE TABLE IF NOT EXISTS public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  scheduled_at timestamp with time zone NOT NULL,
  location text,
  notes text,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  reminder_sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interviews_application_idx
  ON public.interviews (application_id);
CREATE INDEX IF NOT EXISTS interviews_upcoming_idx
  ON public.interviews (scheduled_at) WHERE status = 'scheduled';

DROP TRIGGER IF EXISTS set_interviews_updated_at ON public.interviews;
CREATE TRIGGER set_interviews_updated_at
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- the applicant and the recruiter can both see the interview
DROP POLICY IF EXISTS interviews_select ON public.interviews;
CREATE POLICY interviews_select
  ON public.interviews FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications AS a
      WHERE a.id = application_id
    )
  );

-- only the recruiter who owns the posting can schedule, change or cancel it
DROP POLICY IF EXISTS interviews_manage_recruiter ON public.interviews;
CREATE POLICY interviews_manage_recruiter
  ON public.interviews FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications AS a
      JOIN public.jobs AS j ON j.id = a.job_id
      WHERE a.id = application_id
        AND j.recruiter_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applications AS a
      JOIN public.jobs AS j ON j.id = a.job_id
      WHERE a.id = application_id
        AND j.recruiter_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON TABLE public.interviews FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.interviews TO authenticated;
