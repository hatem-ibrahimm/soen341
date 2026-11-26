-- CareerConnect database health check
--
-- Paste the whole file into the Supabase SQL Editor and run it. The result is
-- one table: structure checks first (tables, columns, security, triggers,
-- storage, migrations), then behaviour tests for Sprint 2 and Sprint 3.
-- Every row should say PASS.
--
-- Test data is created inside a block that is rolled back at the end, so
-- nothing is saved to the database.

DO $t$
DECLARE
  results jsonb := '[]'::jsonb;
  recruiter uuid := 'f3000000-0000-4000-8000-000000000001';
  rival     uuid := 'f3000000-0000-4000-8000-000000000002';
  seeker    uuid := 'f3000000-0000-4000-8000-000000000003';
  outsider  uuid := 'f3000000-0000-4000-8000-000000000004';
  v_job bigint;
  v_app uuid;
  v_resume uuid;
  v_notif uuid;
  v_interview uuid;
  v_draft bigint;
  missing_versions text;
  n int;
  ok boolean;
BEGIN
  -- migrations recorded by Supabase (checked here so the file also runs on plain Postgres)
  IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
    missing_versions := 'SKIP: not a Supabase database';
  ELSE
    EXECUTE 'SELECT string_agg(v, '', '') FROM unnest($1) AS v
             WHERE v NOT IN (SELECT version FROM supabase_migrations.schema_migrations)'
      INTO missing_versions
      USING ARRAY['20260927040229','20260927205357','20260928050806','20261025203413','20261025210000',
                  '20261026120000','20261026120100','20261026120200','20261114063723','20261114082419',
                  '20261115085104','20261115090114','20261115092531','20261115100408','20261115104938',
                  '20261116133000','20261116140200','20261123171000','20261125190000'];
    missing_versions := COALESCE('FAIL: missing ' || missing_versions, 'PASS');
  END IF;
  results := results || jsonb_build_object('feature', 'Structure', 'test', 'DB-MIGRATIONS',
    'checks', 'all migrations in the repository are applied', 'result', missing_versions);

  BEGIN
    -- ---------------------------------------------------------------------
    -- Setup: two recruiters, two job seekers, one posting, one application
    -- ---------------------------------------------------------------------
    INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data) VALUES
      (recruiter, 's3-recruiter@test.invalid',
       '{"first_name": "Rae", "last_name": "Recruiter", "role": "recruiter", "company_name": "Northwind"}', '{}'),
      (rival, 's3-rival@test.invalid',
       '{"first_name": "Rob", "last_name": "Rival", "role": "recruiter", "company_name": "Contoso"}', '{}'),
      (seeker, 's3-seeker@test.invalid',
       '{"first_name": "Ada", "last_name": "Seeker", "role": "job_seeker"}', '{}'),
      (outsider, 's3-outsider@test.invalid',
       '{"first_name": "Bob", "last_name": "Other"}', '{}');

    INSERT INTO public.jobs (recruiter_id, title, company_name, location, category, description, status)
    VALUES (recruiter, 'Junior Developer', 'Northwind', 'Montreal, QC', 'Engineering', 'Build things.', 'published')
    RETURNING id INTO v_job;

    INSERT INTO public.resumes (profile_id, file_name, storage_path, content_type, file_size)
    VALUES (seeker, 'cv.pdf', seeker::text || '/cv.pdf', 'application/pdf', 1000)
    RETURNING id INTO v_resume;

    INSERT INTO public.applications (applicant_id, job_id, resume_id, cover_letter, status)
    VALUES (seeker, v_job, v_resume, 'Hello', 'Applied')
    RETURNING id INTO v_app;

    -- ---------------------------------------------------------------------
    -- Sprint 2: profiles, resumes, job search and applications
    -- ---------------------------------------------------------------------
    BEGIN
      results := results || jsonb_build_object('feature', 'Sprint 2: profiles', 'test', 'AT-S2-P1',
        'checks', 'signing up creates a profile with the names that were given',
        'result', CASE WHEN EXISTS (SELECT 1 FROM public.profiles
                                    WHERE id = seeker AND first_name = 'Ada' AND last_name = 'Seeker')
                       THEN 'PASS' ELSE 'FAIL' END);

      INSERT INTO public.jobs (recruiter_id, title, company_name, location, category, description, status)
      VALUES (rival, 'Hidden Draft', 'Contoso', 'Remote', 'Engineering', 'Not published yet.', 'draft')
      RETURNING id INTO v_draft;

      PERFORM set_config('request.jwt.claim.sub', seeker::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', seeker, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;

      UPDATE public.profiles SET bio = 'Looking for an internship.' WHERE id = seeker;
      UPDATE public.profiles SET bio = 'changed by someone else' WHERE id = outsider;
      results := results || jsonb_build_object('feature', 'Sprint 2: profiles', 'test', 'AT-S2-P2',
        'checks', 'a user can edit their own profile but not someone else''s',
        'result', CASE WHEN (SELECT bio FROM public.profiles WHERE id = seeker) = 'Looking for an internship.'
                        AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = outsider)
                       THEN 'PASS' ELSE 'FAIL' END);

      results := results || jsonb_build_object('feature', 'Sprint 2: job search', 'test', 'AT-S2-J1',
        'checks', 'a job seeker sees published postings but not drafts',
        'result', CASE WHEN EXISTS (SELECT 1 FROM public.jobs WHERE id = v_job)
                        AND NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = v_draft)
                       THEN 'PASS' ELSE 'FAIL' END);

      ok := false;
      BEGIN
        INSERT INTO public.applications (applicant_id, job_id, status) VALUES (seeker, v_draft, 'Applied');
      EXCEPTION WHEN insufficient_privilege THEN ok := true;
      END;
      results := results || jsonb_build_object('feature', 'Sprint 2: applications', 'test', 'AT-S2-A1',
        'checks', 'a job seeker cannot apply to a posting that is not published',
        'result', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);

      ok := false;
      BEGIN
        INSERT INTO public.applications (applicant_id, job_id, status) VALUES (seeker, v_job, 'Applied');
      EXCEPTION WHEN unique_violation THEN ok := true;
      END;
      results := results || jsonb_build_object('feature', 'Sprint 2: applications', 'test', 'AT-S2-A2',
        'checks', 'a job seeker cannot apply twice to the same posting',
        'result', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);

      UPDATE public.applications SET status = 'Offered' WHERE id = v_app;
      results := results || jsonb_build_object('feature', 'Sprint 2: applications', 'test', 'AT-S2-A3',
        'checks', 'a job seeker can track their application but not change its status',
        'result', CASE WHEN (SELECT status FROM public.applications WHERE id = v_app) = 'Applied'
                       THEN 'PASS' ELSE 'FAIL' END);

      PERFORM set_config('request.jwt.claim.sub', outsider::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', outsider, 'role', 'authenticated')::text, true);
      results := results || jsonb_build_object('feature', 'Sprint 2: resumes', 'test', 'AT-S2-R1',
        'checks', 'other users cannot see someone''s resume or applications',
        'result', CASE WHEN NOT EXISTS (SELECT 1 FROM public.resumes WHERE id = v_resume)
                        AND NOT EXISTS (SELECT 1 FROM public.applications WHERE id = v_app)
                       THEN 'PASS' ELSE 'FAIL' END);
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_object('feature', 'Sprint 2', 'test', 'AT-S2',
        'checks', 'could not run', 'result', 'ERROR: ' || SQLERRM);
    END;

    -- ---------------------------------------------------------------------
    -- Notifications and reminders
    -- ---------------------------------------------------------------------
    BEGIN
      -- the backend creates notifications when an application changes
      INSERT INTO public.notifications (user_id, application_id, type, title, message)
      VALUES (recruiter, v_app, 'new_application', 'New Job Application', 'Ada applied.');
      INSERT INTO public.notifications (user_id, application_id, type, title, message)
      VALUES (seeker, v_app, 'application_status', 'Application update', 'Now Under Review.')
      RETURNING id INTO v_notif;

      PERFORM set_config('request.jwt.claim.sub', seeker::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', seeker, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;

      SELECT count(*) INTO n FROM public.notifications;
      results := results || jsonb_build_object('feature', 'Notifications', 'test', 'AT-S3-N1',
        'checks', 'a user sees only their own notifications',
        'result', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END);

      SELECT count(*) INTO n FROM public.notifications WHERE is_read = false;
      UPDATE public.notifications SET is_read = true WHERE id = v_notif;
      results := results || jsonb_build_object('feature', 'Notifications', 'test', 'AT-S3-N2',
        'checks', 'a new notification is unread and can be marked as read',
        'result', CASE WHEN n = 1 AND (SELECT is_read FROM public.notifications WHERE id = v_notif)
                       THEN 'PASS' ELSE 'FAIL' END);

      ok := false;
      BEGIN
        UPDATE public.notifications SET message = 'changed' WHERE id = v_notif;
      EXCEPTION WHEN insufficient_privilege THEN ok := true;
      END;
      results := results || jsonb_build_object('feature', 'Notifications', 'test', 'AT-S3-N3',
        'checks', 'a user cannot rewrite a notification',
        'result', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);

      ok := false;
      BEGIN
        INSERT INTO public.notifications (user_id, type, title, message)
        VALUES (seeker, 'fake', 'Fake', 'Fake');
      EXCEPTION WHEN insufficient_privilege THEN ok := true;
      END;
      results := results || jsonb_build_object('feature', 'Notifications', 'test', 'AT-S3-N4',
        'checks', 'a user cannot create notifications themselves',
        'result', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_object('feature', 'Notifications', 'test', 'AT-S3-N',
        'checks', 'could not run', 'result', 'ERROR: ' || SQLERRM);
    END;

    -- ---------------------------------------------------------------------
    -- Recruiter dashboard and posting management
    -- ---------------------------------------------------------------------
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', recruiter::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', recruiter, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;

      SELECT count(*) INTO n FROM public.applications WHERE job_id = v_job AND status = 'Applied';
      results := results || jsonb_build_object('feature', 'Recruiter dashboard', 'test', 'AT-S3-D1',
        'checks', 'a recruiter sees the applications to their posting, filtered by status',
        'result', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END);

      results := results || jsonb_build_object('feature', 'Recruiter dashboard', 'test', 'AT-S3-D2',
        'checks', 'a recruiter can review the applicant''s profile and submitted resume',
        'result', CASE WHEN EXISTS (SELECT 1 FROM public.profiles WHERE id = seeker)
                        AND EXISTS (SELECT 1 FROM public.resumes WHERE id = v_resume)
                        AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = outsider)
                       THEN 'PASS' ELSE 'FAIL' END);

      UPDATE public.applications SET status = 'Interview' WHERE id = v_app;
      results := results || jsonb_build_object('feature', 'Recruiter dashboard', 'test', 'AT-S3-D3',
        'checks', 'a recruiter can update a candidate''s status',
        'result', CASE WHEN (SELECT status FROM public.applications WHERE id = v_app) = 'Interview'
                       THEN 'PASS' ELSE 'FAIL' END);

      PERFORM set_config('request.jwt.claim.sub', rival::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', rival, 'role', 'authenticated')::text, true);
      results := results || jsonb_build_object('feature', 'Recruiter dashboard', 'test', 'AT-S3-D4',
        'checks', 'another recruiter cannot see these applications, the profile or the resume',
        'result', CASE WHEN NOT EXISTS (SELECT 1 FROM public.applications WHERE id = v_app)
                        AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = seeker)
                        AND NOT EXISTS (SELECT 1 FROM public.resumes WHERE id = v_resume)
                       THEN 'PASS' ELSE 'FAIL' END);

      PERFORM set_config('request.jwt.claim.sub', recruiter::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', recruiter, 'role', 'authenticated')::text, true);
      UPDATE public.jobs SET status = 'archived' WHERE id = v_job;
      PERFORM set_config('request.jwt.claim.sub', outsider::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', outsider, 'role', 'authenticated')::text, true);
      results := results || jsonb_build_object('feature', 'Recruiter dashboard', 'test', 'AT-S3-D5',
        'checks', 'a posting can be archived, and job seekers no longer see it',
        'result', CASE WHEN NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = v_job)
                       THEN 'PASS' ELSE 'FAIL' END);
      RESET ROLE;

      ok := false;
      BEGIN
        UPDATE public.jobs SET status = 'deleted' WHERE id = v_job;
      EXCEPTION WHEN check_violation THEN ok := true;
      END;
      results := results || jsonb_build_object('feature', 'Recruiter dashboard', 'test', 'AT-S3-D6',
        'checks', 'an unknown posting status is rejected',
        'result', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_object('feature', 'Recruiter dashboard', 'test', 'AT-S3-D',
        'checks', 'could not run', 'result', 'ERROR: ' || SQLERRM);
    END;

    -- ---------------------------------------------------------------------
    -- Application analytics and history
    -- ---------------------------------------------------------------------
    BEGIN
      UPDATE public.applications SET status = 'Applied' WHERE id = v_app;
      DELETE FROM public.application_status_history WHERE application_id = v_app;
      INSERT INTO public.application_status_history (application_id, old_status, new_status)
      VALUES (v_app, NULL, 'Applied');

      UPDATE public.applications SET status = 'Under Review' WHERE id = v_app;
      UPDATE public.applications SET cover_letter = 'Edited letter' WHERE id = v_app;
      UPDATE public.applications SET status = 'Interview' WHERE id = v_app;

      SELECT count(*) INTO n FROM public.application_status_history WHERE application_id = v_app;
      results := results || jsonb_build_object('feature', 'Analytics and history', 'test', 'AT-S3-H1',
        'checks', 'every status change is recorded, other edits are not',
        'result', CASE WHEN n = 3 AND EXISTS (
                         SELECT 1 FROM public.application_status_history
                         WHERE application_id = v_app AND old_status = 'Under Review' AND new_status = 'Interview')
                       THEN 'PASS' ELSE 'FAIL' END);

      INSERT INTO public.jobs (recruiter_id, title, company_name, location, category, description, status)
      VALUES (recruiter, 'QA Tester', 'Northwind', 'Remote', 'Engineering', 'Test things.', 'published')
      RETURNING id INTO v_job;
      INSERT INTO public.applications (applicant_id, job_id, status) VALUES (seeker, v_job, 'Applied');
      results := results || jsonb_build_object('feature', 'Analytics and history', 'test', 'AT-S3-H2',
        'checks', 'a new application starts its history automatically',
        'result', CASE WHEN EXISTS (
                         SELECT 1 FROM public.application_status_history AS h
                         JOIN public.applications AS a ON a.id = h.application_id
                         WHERE a.job_id = v_job AND h.old_status IS NULL AND h.new_status = 'Applied')
                       THEN 'PASS' ELSE 'FAIL' END);

      PERFORM set_config('request.jwt.claim.sub', seeker::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', seeker, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;

      results := results || jsonb_build_object('feature', 'Analytics and history', 'test', 'AT-S3-H3',
        'checks', 'a job seeker gets a breakdown of their applications by status',
        'result', CASE WHEN (SELECT jsonb_object_agg(status, c) FROM (
                               SELECT status, count(*) AS c FROM public.applications
                               WHERE applicant_id = seeker GROUP BY status) AS s)
                            = '{"Applied": 1, "Interview": 1}'::jsonb
                       THEN 'PASS' ELSE 'FAIL' END);

      SELECT count(*) INTO n FROM public.application_status_history;
      results := results || jsonb_build_object('feature', 'Analytics and history', 'test', 'AT-S3-H4',
        'checks', 'a job seeker can read the history of their own applications',
        'result', CASE WHEN n = 4 THEN 'PASS' ELSE 'FAIL' END);

      ok := false;
      BEGIN
        INSERT INTO public.application_status_history (application_id, new_status) VALUES (v_app, 'Offered');
      EXCEPTION WHEN insufficient_privilege THEN ok := true;
      END;
      results := results || jsonb_build_object('feature', 'Analytics and history', 'test', 'AT-S3-H5',
        'checks', 'the history cannot be edited by users',
        'result', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);

      PERFORM set_config('request.jwt.claim.sub', outsider::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', outsider, 'role', 'authenticated')::text, true);
      SELECT count(*) INTO n FROM public.application_status_history;
      results := results || jsonb_build_object('feature', 'Analytics and history', 'test', 'AT-S3-H6',
        'checks', 'other users cannot read someone else''s history',
        'result', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END);
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_object('feature', 'Analytics and history', 'test', 'AT-S3-H',
        'checks', 'could not run', 'result', 'ERROR: ' || SQLERRM);
    END;

    -- ---------------------------------------------------------------------
    -- Recruiter accounts (role chosen at sign-up)
    -- ---------------------------------------------------------------------
    BEGIN
      results := results || jsonb_build_object('feature', 'Recruiter accounts', 'test', 'AT-S3-R1',
        'checks', 'signing up as a recruiter creates the recruiter record with their name and company',
        'result', CASE WHEN (SELECT company_name FROM public.recruiters WHERE id = recruiter) = 'Northwind'
                        AND (SELECT full_name FROM public.recruiters WHERE id = recruiter) = 'Rae Recruiter'
                       THEN 'PASS' ELSE 'FAIL' END);

      results := results || jsonb_build_object('feature', 'Recruiter accounts', 'test', 'AT-S3-R2',
        'checks', 'signing up as a job seeker does not',
        'result', CASE WHEN NOT EXISTS (SELECT 1 FROM public.recruiters WHERE id IN (seeker, outsider))
                       THEN 'PASS' ELSE 'FAIL' END);

      UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"role": "recruiter"}'
      WHERE id = seeker;
      results := results || jsonb_build_object('feature', 'Recruiter accounts', 'test', 'AT-S3-R3',
        'checks', 'a job seeker cannot become a recruiter by editing their sign-up data',
        'result', CASE WHEN NOT EXISTS (SELECT 1 FROM public.recruiters WHERE id = seeker)
                       THEN 'PASS' ELSE 'FAIL' END);

      PERFORM set_config('request.jwt.claim.sub', recruiter::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', recruiter, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;

      INSERT INTO public.jobs (recruiter_id, title, company_name, location, category, description)
      VALUES (recruiter, 'Designer', 'Northwind', 'Remote', 'Design', 'Design things.');
      UPDATE public.recruiters SET company_website = 'https://northwind.test' WHERE id = recruiter;
      UPDATE public.recruiters SET company_name = 'Hacked' WHERE id = rival;
      results := results || jsonb_build_object('feature', 'Recruiter accounts', 'test', 'AT-S3-R4',
        'checks', 'a recruiter can post a job and edit only their own company info',
        'result', CASE WHEN (SELECT company_website FROM public.recruiters WHERE id = recruiter) = 'https://northwind.test'
                        AND (SELECT company_name FROM public.recruiters WHERE id = rival) = 'Contoso'
                       THEN 'PASS' ELSE 'FAIL' END);

      PERFORM set_config('request.jwt.claim.sub', seeker::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', seeker, 'role', 'authenticated')::text, true);
      ok := false;
      BEGIN
        INSERT INTO public.jobs (recruiter_id, title, company_name, location, category, description)
        VALUES (seeker, 'Fake job', 'Fake', 'Nowhere', 'None', 'Not allowed.');
      EXCEPTION WHEN insufficient_privilege THEN ok := true;
      END;
      IF ok THEN
        ok := false;
        BEGIN
          INSERT INTO public.recruiters (id) VALUES (seeker);
        EXCEPTION WHEN insufficient_privilege THEN ok := true;
        END;
      END IF;
      results := results || jsonb_build_object('feature', 'Recruiter accounts', 'test', 'AT-S3-R5',
        'checks', 'a job seeker cannot post a job or add themselves as a recruiter',
        'result', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_object('feature', 'Recruiter accounts', 'test', 'AT-S3-R',
        'checks', 'could not run', 'result', 'ERROR: ' || SQLERRM);
    END;

    -- ---------------------------------------------------------------------
    -- Reminders: application deadlines and interview invitations
    -- ---------------------------------------------------------------------
    BEGIN
      PERFORM set_config('request.jwt.claim.sub', recruiter::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', recruiter, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;

      UPDATE public.jobs SET application_deadline = current_date + 7 WHERE id = v_job;
      INSERT INTO public.interviews (application_id, scheduled_at, location)
      VALUES (v_app, now() + interval '2 days', 'Room 101')
      RETURNING id INTO v_interview;

      PERFORM set_config('request.jwt.claim.sub', seeker::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', seeker, 'role', 'authenticated')::text, true);

      results := results || jsonb_build_object('feature', 'Reminders', 'test', 'AT-S3-M1',
        'checks', 'a recruiter can set a deadline on a posting and job seekers see it',
        'result', CASE WHEN (SELECT application_deadline FROM public.jobs WHERE id = v_job) = current_date + 7
                       THEN 'PASS' ELSE 'FAIL' END);

      results := results || jsonb_build_object('feature', 'Reminders', 'test', 'AT-S3-M2',
        'checks', 'a recruiter can schedule an interview and the applicant sees it',
        'result', CASE WHEN (SELECT location FROM public.interviews WHERE id = v_interview) = 'Room 101'
                       THEN 'PASS' ELSE 'FAIL' END);

      SELECT count(*) INTO n FROM public.interviews
      WHERE status = 'scheduled' AND scheduled_at BETWEEN now() AND now() + interval '7 days';
      results := results || jsonb_build_object('feature', 'Reminders', 'test', 'AT-S3-M3',
        'checks', 'upcoming interviews can be listed for reminders',
        'result', CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END);

      UPDATE public.interviews SET scheduled_at = now() + interval '30 days' WHERE id = v_interview;
      ok := false;
      BEGIN
        INSERT INTO public.interviews (application_id, scheduled_at) VALUES (v_app, now() + interval '1 day');
      EXCEPTION WHEN insufficient_privilege THEN ok := true;
      END;
      results := results || jsonb_build_object('feature', 'Reminders', 'test', 'AT-S3-M4',
        'checks', 'an applicant cannot schedule or move an interview themselves',
        'result', CASE WHEN ok AND (SELECT scheduled_at FROM public.interviews WHERE id = v_interview) < now() + interval '3 days'
                       THEN 'PASS' ELSE 'FAIL' END);

      PERFORM set_config('request.jwt.claim.sub', rival::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', rival, 'role', 'authenticated')::text, true);
      ok := false;
      BEGIN
        INSERT INTO public.interviews (application_id, scheduled_at) VALUES (v_app, now() + interval '1 day');
      EXCEPTION WHEN insufficient_privilege THEN ok := true;
      END;
      results := results || jsonb_build_object('feature', 'Reminders', 'test', 'AT-S3-M5',
        'checks', 'another recruiter cannot see or schedule interviews for this application',
        'result', CASE WHEN ok AND NOT EXISTS (SELECT 1 FROM public.interviews WHERE id = v_interview)
                       THEN 'PASS' ELSE 'FAIL' END);
      RESET ROLE;

      ok := false;
      BEGIN
        UPDATE public.interviews SET status = 'postponed' WHERE id = v_interview;
      EXCEPTION WHEN check_violation THEN ok := true;
      END;
      results := results || jsonb_build_object('feature', 'Reminders', 'test', 'AT-S3-M6',
        'checks', 'an unknown interview status is rejected',
        'result', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_object('feature', 'Reminders', 'test', 'AT-S3-M',
        'checks', 'could not run', 'result', 'ERROR: ' || SQLERRM);
    END;

    -- ---------------------------------------------------------------------
    -- Deleting an account removes everything that belongs to it
    -- ---------------------------------------------------------------------
    BEGIN
      DELETE FROM auth.users WHERE id = seeker;
      results := results || jsonb_build_object('feature', 'Accounts', 'test', 'AT-CLEANUP',
        'checks', 'deleting an account removes its profile, resumes, applications and notifications',
        'result', CASE WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = seeker)
                        AND NOT EXISTS (SELECT 1 FROM public.resumes WHERE profile_id = seeker)
                        AND NOT EXISTS (SELECT 1 FROM public.applications WHERE applicant_id = seeker)
                        AND NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id = seeker)
                       THEN 'PASS' ELSE 'FAIL' END);
    EXCEPTION WHEN OTHERS THEN
      results := results || jsonb_build_object('feature', 'Accounts', 'test', 'AT-CLEANUP',
        'checks', 'could not run', 'result', 'ERROR: ' || SQLERRM);
    END;

    -- undo everything above, keeping only the list of results
    RAISE EXCEPTION USING ERRCODE = 'AT001', MESSAGE = results::text;
  EXCEPTION
    WHEN SQLSTATE 'AT001' THEN
      results := SQLERRM::jsonb;
    WHEN OTHERS THEN
      results := jsonb_build_array(jsonb_build_object('feature', 'Setup', 'test', 'SETUP',
        'checks', 'could not create the test data', 'result', 'ERROR: ' || SQLERRM));
  END;

  PERFORM set_config('at.sprint3_results', results::text, false);
END
$t$;

WITH expected(table_name, column_name) AS (
  VALUES
    ('profiles','id'),('profiles','first_name'),('profiles','last_name'),('profiles','title'),
    ('profiles','email'),('profiles','phone_number'),('profiles','location'),('profiles','bio'),
    ('profiles','profile_picture_path'),('profiles','created_at'),('profiles','updated_at'),
    ('work_experiences','profile_id'),('education','profile_id'),('skills','profile_id'),('skills','name'),
    ('resumes','id'),('resumes','profile_id'),('resumes','file_name'),('resumes','storage_path'),
    ('resumes','content_type'),('resumes','file_size'),('resumes','uploaded_at'),
    ('jobs','id'),('jobs','recruiter_id'),('jobs','title'),('jobs','company_name'),('jobs','location'),
    ('jobs','category'),('jobs','description'),('jobs','required_skills'),('jobs','min_salary'),
    ('jobs','max_salary'),('jobs','status'),('jobs','application_deadline'),('jobs','created_at'),
    ('applications','id'),('applications','applicant_id'),('applications','job_id'),
    ('applications','resume_id'),('applications','cover_letter'),('applications','status'),
    ('applications','created_at'),('applications','contact_email'),('applications','contact_phone'),
    ('resume_feedback','resume_id'),('resume_feedback','resume_updated_at'),('resume_feedback','strengths'),
    ('resume_feedback','areas_for_improvement'),('resume_feedback','recommendations'),
    ('resume_feedback','generated_at'),
    ('notifications','id'),('notifications','user_id'),('notifications','application_id'),
    ('notifications','type'),('notifications','title'),('notifications','message'),
    ('notifications','is_read'),('notifications','created_at'),
    ('application_status_history','application_id'),('application_status_history','old_status'),
    ('application_status_history','new_status'),('application_status_history','changed_at'),
    ('recruiters','id'),('recruiters','full_name'),('recruiters','company_name'),
    ('recruiters','company_website'),('recruiters','company_description'),('recruiters','role_title'),
    ('interviews','id'),('interviews','application_id'),('interviews','scheduled_at'),
    ('interviews','location'),('interviews','notes'),('interviews','status'),
    ('interviews','reminder_sent_at')
),
missing AS (
  SELECT e.table_name, string_agg(e.column_name, ', ' ORDER BY e.column_name) AS cols,
         to_regclass('public.' || e.table_name) IS NULL AS table_missing
  FROM expected AS e
  LEFT JOIN information_schema.columns AS c
    ON c.table_schema = 'public' AND c.table_name = e.table_name AND c.column_name = e.column_name
  WHERE c.column_name IS NULL
  GROUP BY e.table_name
),
structure AS (
  SELECT 1 AS section, 'Structure' AS feature, 'DB-TABLES' AS test,
         'every table and column the app uses exists' AS checks,
         COALESCE('FAIL: ' || (SELECT string_agg(table_name ||
                  CASE WHEN table_missing THEN ' (table missing)' ELSE ' (' || cols || ')' END, '; ')
                  FROM missing), 'PASS') AS result
  UNION ALL
  SELECT 1, 'Structure', 'DB-RLS', 'row level security is on for every app table',
         COALESCE('FAIL: ' || (SELECT string_agg(c.relname, ', ') FROM pg_class AS c
                  JOIN pg_namespace AS n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity), 'PASS')
  UNION ALL
  SELECT 1, 'Structure', 'DB-TRIGGERS', 'sign-up, status history and updated-at triggers exist',
         COALESCE('FAIL: missing ' || (SELECT string_agg(t, ', ') FROM unnest(ARRAY[
                  'on_auth_user_created', 'on_auth_recruiter_created', 'log_application_status',
                  'set_jobs_updated_at', 'set_applications_updated_at', 'set_recruiters_updated_at',
                  'set_interviews_updated_at']) AS t
                  WHERE NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = t AND NOT tgisinternal)), 'PASS')
  UNION ALL
  SELECT 1, 'Structure', 'DB-STORAGE', 'the resumes and profile-pictures buckets exist and are private',
         CASE WHEN (SELECT count(*) FROM storage.buckets
                    WHERE id IN ('resumes', 'profile-pictures') AND NOT public) = 2
              THEN 'PASS' ELSE 'FAIL' END
)
SELECT feature, test, checks, result
FROM (
  SELECT * FROM structure
  UNION ALL
  SELECT 2, r ->> 'feature', r ->> 'test', r ->> 'checks', r ->> 'result'
  FROM jsonb_array_elements(current_setting('at.sprint3_results')::jsonb) AS r
) AS all_checks
ORDER BY section;
