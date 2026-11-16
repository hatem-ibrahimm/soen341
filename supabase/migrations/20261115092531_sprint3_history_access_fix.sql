-- Sprint 3: fix who can read the application status history
-- The first version looked the posting up as well, so a job seeker lost
-- access to their own history once the posting was closed or archived.
-- Now: whoever can see the application can see its history.

DROP POLICY IF EXISTS application_status_history_select ON public.application_status_history;
CREATE POLICY application_status_history_select
  ON public.application_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications AS a
      WHERE a.id = application_id
    )
  );
