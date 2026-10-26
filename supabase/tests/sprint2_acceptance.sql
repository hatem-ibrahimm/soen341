-- ===========================================================================
-- Sprint 2 acceptance tests - DATABASE level
--
-- Checks that the schema behaves the way each Sprint 2 user story expects
-- (see docs/sprint_2/user_stories_and_acceptance_tests.md).
--
-- Run (local Supabase must be running, after `supabase db reset`):
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f supabase/tests/sprint2_acceptance.sql
--
-- Everything runs inside ONE transaction that is rolled back at the end, so
-- no test data is left behind. A failing test raises an exception and psql
-- exits with an error. Passing tests print "PASS ...".
-- ===========================================================================
\set ON_ERROR_STOP on
\set QUIET on
BEGIN;

-- Test accounts (fixed ids so the tests can refer to them)
INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'at-seeker1@test.invalid',
   '{"first_name": "Ada", "last_name": "Seeker"}', '{}'),
  ('f0000000-0000-4000-8000-000000000002', 'at-seeker2@test.invalid',
   '{"first_name": "Bob", "last_name": "Other"}', '{}'),
  ('f0000000-0000-4000-8000-000000000003', 'at-recruiter1@test.invalid',
   '{"first_name": "Rae", "last_name": "Recruiter"}', '{"role": "recruiter"}'),
  ('f0000000-0000-4000-8000-000000000004', 'at-recruiter2@test.invalid',
   '{"first_name": "Rob", "last_name": "Rival"}', '{"role": "recruiter"}');

-- ---------------------------------------------------------------------------
-- US: create and edit my professional profile (S2-01)
-- ---------------------------------------------------------------------------
DO $t$
DECLARE r record;
BEGIN
  -- AT-S2-01-A: registering creates a profile with the names that were given
  SELECT * INTO r FROM public.profiles
  WHERE id = 'f0000000-0000-4000-8000-000000000001';
  IF r.id IS NULL OR r.first_name <> 'Ada' OR r.last_name <> 'Seeker'
     OR r.email <> 'at-seeker1@test.invalid' THEN
    RAISE EXCEPTION 'FAIL AT-S2-01-A: profile was not created from signup data';
  END IF;
  RAISE NOTICE 'PASS AT-S2-01-A  registering creates the profile automatically';

  -- AT-S2-01-B: personal and professional information can be saved and read back
  UPDATE public.profiles
  SET title = 'Software Engineering Student', phone_number = '514-555-0100',
      location = 'Montreal, QC', bio = 'Looking for an internship.'
  WHERE id = r.id;
  INSERT INTO public.work_experiences (profile_id, job_title, company, dates, description)
  VALUES (r.id, 'Web Developer Intern', 'Northwind', '2025', 'Built UIs');
  INSERT INTO public.education (profile_id, school, degree, years)
  VALUES (r.id, 'Concordia University', 'BEng Software Engineering', '2024-2028');
  INSERT INTO public.skills (profile_id, name) VALUES (r.id, 'React'), (r.id, 'Python');

  IF (SELECT title FROM public.profiles WHERE id = r.id) <> 'Software Engineering Student'
     OR (SELECT count(*) FROM public.work_experiences WHERE profile_id = r.id) <> 1
     OR (SELECT count(*) FROM public.education WHERE profile_id = r.id) <> 1
     OR (SELECT count(*) FROM public.skills WHERE profile_id = r.id) <> 2 THEN
    RAISE EXCEPTION 'FAIL AT-S2-01-B: profile data was not stored correctly';
  END IF;

  -- the same skill twice (even with different capitals) is refused
  BEGIN
    INSERT INTO public.skills (profile_id, name) VALUES (r.id, 'react');
    RAISE EXCEPTION 'FAIL AT-S2-01-B: duplicate skill was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS AT-S2-01-B  profile, experience, education and skills are saved; duplicate skill refused';
END
$t$;

-- ---------------------------------------------------------------------------
-- US: upload, replace and delete my resume (S2-03)
-- ---------------------------------------------------------------------------
DO $t$
DECLARE seeker uuid := 'f0000000-0000-4000-8000-000000000001'; n int;
BEGIN
  -- AT-S2-03-A: a resume can be stored and is linked to its owner
  INSERT INTO public.resumes (profile_id, file_name, storage_path, content_type, file_size)
  VALUES (seeker, 'cv.pdf', seeker || '/a.pdf', 'application/pdf', 1000);
  IF (SELECT count(*) FROM public.resumes WHERE profile_id = seeker) <> 1 THEN
    RAISE EXCEPTION 'FAIL AT-S2-03-A: resume was not stored';
  END IF;

  -- AT-S2-03-B: only one resume per user; replacing updates it, deleting removes it
  BEGIN
    INSERT INTO public.resumes (profile_id, file_name, storage_path, content_type, file_size)
    VALUES (seeker, 'second.pdf', seeker || '/b.pdf', 'application/pdf', 5);
    RAISE EXCEPTION 'FAIL AT-S2-03-B: a second resume was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  UPDATE public.resumes
  SET file_name = 'new.pdf', storage_path = seeker || '/c.pdf', file_size = 2000
  WHERE profile_id = seeker;
  IF (SELECT file_name FROM public.resumes WHERE profile_id = seeker) <> 'new.pdf' THEN
    RAISE EXCEPTION 'FAIL AT-S2-03-B: resume was not replaced';
  END IF;
  PERFORM set_config('at.resume', (SELECT id::text FROM public.resumes WHERE profile_id = seeker), true);
  RAISE NOTICE 'PASS AT-S2-03-A/B  resume stored, limited to one per user, replaceable';
END
$t$;

-- ---------------------------------------------------------------------------
-- US: recruiter creates job postings (S2-11)  +  job search (S2-05..07)
-- ---------------------------------------------------------------------------
DO $t$
DECLARE rec uuid := 'f0000000-0000-4000-8000-000000000003'; jp bigint; jd bigint; n int;
BEGIN
  -- AT-S2-11-A: a new posting starts as a draft, a published one can be created
  INSERT INTO public.jobs (recruiter_id, title, company_name, location, category, description,
                           required_skills, min_salary, max_salary, status)
  VALUES (rec, 'Zzqa Engineer', 'AT Corp', 'Atlantis', 'Zzcategory', 'Test the platform end to end',
          ARRAY['Testing', 'SQL'], 70000, 90000, 'published') RETURNING id INTO jp;
  INSERT INTO public.jobs (recruiter_id, title, company_name, location, category, description)
  VALUES (rec, 'Zzqa Draft Role', 'AT Corp', 'Atlantis', 'Zzcategory', 'Not public yet')
  RETURNING id INTO jd;
  IF (SELECT status FROM public.jobs WHERE id = jd) <> 'draft' THEN
    RAISE EXCEPTION 'FAIL AT-S2-11-A: new job did not start as draft';
  END IF;
  PERFORM set_config('at.job_pub', jp::text, true);
  PERFORM set_config('at.job_draft', jd::text, true);

  -- AT-S2-11-B: invalid data is rejected (bad status, salary range reversed)
  BEGIN
    INSERT INTO public.jobs (recruiter_id, title, company_name, location, category, description, status)
    VALUES (rec, 't', 'c', 'l', 'c', 'd', 'open');
    RAISE EXCEPTION 'FAIL AT-S2-11-B: invalid status accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.jobs (recruiter_id, title, company_name, location, category, description, min_salary, max_salary)
    VALUES (rec, 't', 'c', 'l', 'c', 'd', 90000, 10000);
    RAISE EXCEPTION 'FAIL AT-S2-11-B: reversed salary range accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS AT-S2-11-A/B  draft by default; invalid status and salary range refused';

  -- AT-S2-06-A: keyword search only finds PUBLISHED jobs (same query as GET /api/jobs)
  SELECT count(*) INTO n FROM public.jobs
  WHERE status = 'published'
    AND (title ILIKE '%zzqa%' OR company_name ILIKE '%zzqa%' OR description ILIKE '%zzqa%'
         OR location ILIKE '%zzqa%' OR category ILIKE '%zzqa%');
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL AT-S2-06-A: keyword search returned % jobs, expected 1', n; END IF;

  -- AT-S2-06-B: location, category and salary filters narrow the results
  SELECT count(*) INTO n FROM public.jobs
  WHERE status = 'published' AND location ILIKE '%atlantis%' AND category ILIKE '%zzcategory%'
    AND (max_salary IS NULL OR max_salary >= 80000) AND (min_salary IS NULL OR min_salary <= 100000);
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL AT-S2-06-B: filters returned % jobs, expected 1', n; END IF;
  SELECT count(*) INTO n FROM public.jobs
  WHERE status = 'published' AND location ILIKE '%atlantis%'
    AND (max_salary IS NULL OR max_salary >= 150000);
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL AT-S2-06-B: salary filter did not exclude the job'; END IF;
  RAISE NOTICE 'PASS AT-S2-06-A/B  keyword, location, category and salary filters work; drafts hidden';

  -- AT-S2-07-A: job details expose everything the details page shows
  PERFORM id, title, company_name, location, category, description, required_skills,
          min_salary, max_salary, created_at
  FROM public.jobs WHERE id = jp AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL AT-S2-07-A: published job details not found'; END IF;
  RAISE NOTICE 'PASS AT-S2-07-A  published job details can be read';
END
$t$;

-- ---------------------------------------------------------------------------
-- US: apply for a job (S2-08/09) and track my application (S2-10)
-- Run as a logged-in job seeker (Row Level Security applies)
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
DO $t$ BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'f0000000-0000-4000-8000-000000000001', true);
  PERFORM set_config('request.jwt.claims',
    '{"sub": "f0000000-0000-4000-8000-000000000001", "role": "authenticated", "app_metadata": {}}', true);
END $t$;

DO $t$
DECLARE
  seeker uuid := 'f0000000-0000-4000-8000-000000000001';
  other  uuid := 'f0000000-0000-4000-8000-000000000002';
  jp bigint := current_setting('at.job_pub')::bigint;
  jd bigint := current_setting('at.job_draft')::bigint;
  rid uuid := current_setting('at.resume')::uuid;
  aid uuid; n int;
BEGIN
  -- AT-S2-05-A: a seeker sees the published job but not another recruiter's draft
  IF NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = jp) THEN
    RAISE EXCEPTION 'FAIL AT-S2-05-A: seeker cannot see the published job';
  END IF;
  IF EXISTS (SELECT 1 FROM public.jobs WHERE id = jd) THEN
    RAISE EXCEPTION 'FAIL AT-S2-05-A: seeker can see a draft job';
  END IF;
  RAISE NOTICE 'PASS AT-S2-05-A  seeker sees published jobs only';

  -- AT-S2-08-A: apply with my resume and a cover letter -> status starts as Applied
  INSERT INTO public.applications (applicant_id, job_id, resume_id, cover_letter, status)
  VALUES (seeker, jp, rid, 'I would love to join.', 'Applied') RETURNING id INTO aid;
  IF (SELECT status FROM public.applications WHERE id = aid) <> 'Applied' THEN
    RAISE EXCEPTION 'FAIL AT-S2-08-A: application did not start as Applied';
  END IF;
  PERFORM set_config('at.application', aid::text, true);

  -- AT-S2-08-B: cannot apply twice, to a draft job, as someone else, or skip ahead
  BEGIN
    INSERT INTO public.applications (applicant_id, job_id, status) VALUES (seeker, jp, 'Applied');
    RAISE EXCEPTION 'FAIL AT-S2-08-B: duplicate application accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.applications (applicant_id, job_id, status) VALUES (seeker, jd, 'Applied');
    RAISE EXCEPTION 'FAIL AT-S2-08-B: application to a draft job accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.applications (applicant_id, job_id, status) VALUES (other, jp, 'Applied');
    RAISE EXCEPTION 'FAIL AT-S2-08-B: applied on behalf of another user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS AT-S2-08-A/B  apply works; duplicate, draft job and impersonation refused';

  -- AT-S2-10-A: I can read my own application; the five statuses are the only allowed values
  SELECT count(*) INTO n FROM public.applications WHERE applicant_id = seeker AND job_id = jp;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL AT-S2-10-A: seeker cannot read own application'; END IF;
  RAISE NOTICE 'PASS AT-S2-10-A  seeker can read own application and its status';

  -- AT-S2-10-B: a seeker cannot change their own status
  UPDATE public.applications SET status = 'Offered' WHERE id = aid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL AT-S2-10-B: seeker changed their own status'; END IF;
  RAISE NOTICE 'PASS AT-S2-10-B  seeker cannot change their own application status';

  -- AT-S2-03-C / S2-01-C: seeker sees only their own resume and skills
  IF EXISTS (SELECT 1 FROM public.resumes WHERE profile_id <> seeker) THEN
    RAISE EXCEPTION 'FAIL AT-S2-03-C: seeker can see other resumes';
  END IF;
  IF EXISTS (SELECT 1 FROM public.skills WHERE profile_id <> seeker) THEN
    RAISE EXCEPTION 'FAIL AT-S2-01-C: seeker can see other skills';
  END IF;
  RAISE NOTICE 'PASS AT-S2-01-C/03-C  profile data is private to its owner';

  -- a seeker can not create job postings
  BEGIN
    INSERT INTO public.jobs (recruiter_id, title, company_name, location, category, description)
    VALUES (seeker, 't', 'c', 'l', 'c', 'd');
    RAISE EXCEPTION 'FAIL AT-S2-11-C: job seeker created a posting';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS AT-S2-11-C  job seekers cannot create postings';
END
$t$;
RESET ROLE;

-- Another seeker cannot see the first seeker's application
SET LOCAL ROLE authenticated;
DO $t$ BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'f0000000-0000-4000-8000-000000000002', true);
  PERFORM set_config('request.jwt.claims',
    '{"sub": "f0000000-0000-4000-8000-000000000002", "role": "authenticated", "app_metadata": {}}', true);
END $t$;
DO $t$
BEGIN
  IF EXISTS (SELECT 1 FROM public.applications WHERE id = current_setting('at.application')::uuid) THEN
    RAISE EXCEPTION 'FAIL AT-S2-10-C: another seeker can read someone else''s application';
  END IF;
  RAISE NOTICE 'PASS AT-S2-10-C  applications are private to the applicant';
END
$t$;
RESET ROLE;

-- ---------------------------------------------------------------------------
-- US: recruiter manages postings and sees / updates applications (S2-11/12)
-- Run as the recruiter who owns the job
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
DO $t$ BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'f0000000-0000-4000-8000-000000000003', true);
  PERFORM set_config('request.jwt.claims',
    '{"sub": "f0000000-0000-4000-8000-000000000003", "role": "authenticated", "app_metadata": {"role": "recruiter"}}', true);
END $t$;
DO $t$
DECLARE
  rec uuid := 'f0000000-0000-4000-8000-000000000003';
  jp bigint := current_setting('at.job_pub')::bigint;
  jd bigint := current_setting('at.job_draft')::bigint;
  aid uuid := current_setting('at.application')::uuid;
  s text; n int;
BEGIN
  -- AT-S2-12-A: the recruiter sees applications received for their own posting
  IF (SELECT count(*) FROM public.applications WHERE job_id = jp) <> 1 THEN
    RAISE EXCEPTION 'FAIL AT-S2-12-A: recruiter cannot see applications for own job';
  END IF;
  RAISE NOTICE 'PASS AT-S2-12-A  recruiter sees applications received for their posting';

  -- AT-S2-12-B: the recruiter can move the application through all five statuses
  FOREACH s IN ARRAY ARRAY['Under Review', 'Interview', 'Offered', 'Rejected', 'Applied'] LOOP
    UPDATE public.applications SET status = s WHERE id = aid;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 OR (SELECT status FROM public.applications WHERE id = aid) <> s THEN
      RAISE EXCEPTION 'FAIL AT-S2-12-B: could not set status %', s;
    END IF;
  END LOOP;
  BEGIN
    UPDATE public.applications SET status = 'Hired' WHERE id = aid;
    RAISE EXCEPTION 'FAIL AT-S2-12-B: invalid status accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS AT-S2-12-B  all five statuses can be set; invalid status refused';

  -- AT-S2-11-D: a recruiter sees their own draft, edits it, and cannot post as someone else
  IF NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = jd) THEN
    RAISE EXCEPTION 'FAIL AT-S2-11-D: recruiter cannot see own draft';
  END IF;
  UPDATE public.jobs SET title = 'Zzqa Draft Role (edited)', status = 'published' WHERE id = jd;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL AT-S2-11-D: recruiter cannot edit own job'; END IF;
  BEGIN
    INSERT INTO public.jobs (recruiter_id, title, company_name, location, category, description)
    VALUES ('f0000000-0000-4000-8000-000000000004', 't', 'c', 'l', 'c', 'd');
    RAISE EXCEPTION 'FAIL AT-S2-11-D: recruiter posted as another recruiter';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS AT-S2-11-D  recruiter edits and publishes own job only';
END
$t$;
RESET ROLE;

-- A different recruiter cannot see or change them
SET LOCAL ROLE authenticated;
DO $t$ BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'f0000000-0000-4000-8000-000000000004', true);
  PERFORM set_config('request.jwt.claims',
    '{"sub": "f0000000-0000-4000-8000-000000000004", "role": "authenticated", "app_metadata": {"role": "recruiter"}}', true);
END $t$;
DO $t$
DECLARE n int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.applications WHERE id = current_setting('at.application')::uuid) THEN
    RAISE EXCEPTION 'FAIL AT-S2-12-C: rival recruiter can read the application';
  END IF;
  UPDATE public.applications SET status = 'Rejected' WHERE id = current_setting('at.application')::uuid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL AT-S2-12-C: rival recruiter changed a status'; END IF;
  UPDATE public.jobs SET title = 'hijacked' WHERE id = current_setting('at.job_pub')::bigint;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL AT-S2-12-C: rival recruiter edited a job'; END IF;
  RAISE NOTICE 'PASS AT-S2-12-C  other recruiters cannot see or change this posting or its applications';
END
$t$;
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Cleanup behaviour: deleting an account removes everything that belongs to it
-- ---------------------------------------------------------------------------
DO $t$
DECLARE seeker uuid := 'f0000000-0000-4000-8000-000000000001'; n int;
BEGIN
  DELETE FROM auth.users WHERE id = seeker;
  SELECT (SELECT count(*) FROM public.profiles WHERE id = seeker)
       + (SELECT count(*) FROM public.resumes WHERE profile_id = seeker)
       + (SELECT count(*) FROM public.skills WHERE profile_id = seeker)
       + (SELECT count(*) FROM public.work_experiences WHERE profile_id = seeker)
       + (SELECT count(*) FROM public.applications WHERE applicant_id = seeker)
  INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: % rows left behind after deleting an account', n; END IF;
  RAISE NOTICE 'PASS CLEANUP  deleting an account removes its profile, resume, skills and applications';
END
$t$;

ROLLBACK;
\echo 'All Sprint 2 database acceptance tests passed (nothing was saved).'
