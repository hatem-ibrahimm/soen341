CREATE TABLE IF NOT EXISTS public.interview_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  proposed_at timestamp with time zone NOT NULL,
  proposed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_final boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interview_options_application_idx
  ON public.interview_options (application_id, proposed_at);
CREATE UNIQUE INDEX IF NOT EXISTS interview_options_one_final_idx
  ON public.interview_options (application_id) WHERE is_final;

CREATE TABLE IF NOT EXISTS public.interview_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interview_messages_application_idx
  ON public.interview_messages (application_id, created_at);

ALTER TABLE public.interview_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY interview_options_participants_select
  ON public.interview_options FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.applications a JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = application_id AND (a.applicant_id = (SELECT auth.uid()) OR j.recruiter_id = (SELECT auth.uid()))
  ));
CREATE POLICY interview_options_applicant_insert
  ON public.interview_options FOR INSERT TO authenticated
  WITH CHECK (
    proposed_by = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND a.applicant_id = (SELECT auth.uid()) AND a.status = 'Interview'
    )
  );
CREATE POLICY interview_options_recruiter_update
  ON public.interview_options FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.applications a JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = application_id AND j.recruiter_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.applications a JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = application_id AND j.recruiter_id = (SELECT auth.uid())
  ));

CREATE POLICY interview_messages_participants_select
  ON public.interview_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.applications a JOIN public.jobs j ON j.id = a.job_id
    WHERE a.id = application_id AND (a.applicant_id = (SELECT auth.uid()) OR j.recruiter_id = (SELECT auth.uid()))
  ));
CREATE POLICY interview_messages_participants_insert
  ON public.interview_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.applications a JOIN public.jobs j ON j.id = a.job_id
      WHERE a.id = application_id AND a.status = 'Interview'
        AND (a.applicant_id = (SELECT auth.uid()) OR j.recruiter_id = (SELECT auth.uid()))
    )
  );

REVOKE ALL ON TABLE public.interview_options, public.interview_messages FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.interview_options TO authenticated;
GRANT UPDATE (is_final) ON TABLE public.interview_options TO authenticated;
GRANT SELECT, INSERT ON TABLE public.interview_messages TO authenticated;
