-- ===========================================================================
-- Local demo data. Runs automatically on `supabase db reset`.
--
-- Demo logins (LOCAL DEVELOPMENT ONLY - never run this on a real project):
--   recruiter@careerconnect.test  /  Recruiter123!   (role: recruiter)
--   seeker@careerconnect.test     /  Seeker123!      (role: job seeker)
--
-- Safe to run more than once.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Two demo accounts (the signup trigger creates their profiles)
-- ---------------------------------------------------------------------------
-- The recruiter role lives in raw_app_meta_data, which users cannot edit
-- themselves. The backend (recruiter_postings.py) only trusts that field.

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'recruiter@careerconnect.test',
    extensions.crypt('Recruiter123!', extensions.gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"], "role": "recruiter"}',
    '{"first_name": "Dana", "last_name": "Recruiter"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'seeker@careerconnect.test',
    extensions.crypt('Seeker123!', extensions.gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"first_name": "Sam", "last_name": "Seeker"}',
    now(), now(), '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

-- Email/password login needs an identity row too.
INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
SELECT
  u.id, u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email,
                     'email_verified', true),
  now(), now(), now()
FROM auth.users AS u
WHERE u.id IN ('a0000000-0000-4000-8000-000000000001',
               'a0000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. A filled-in profile for the demo job seeker
-- ---------------------------------------------------------------------------

UPDATE public.profiles
SET title = 'Computer Science Student',
    phone_number = '514-555-0100',
    location = 'Montreal, QC',
    bio = 'Third-year student looking for a software internship.'
WHERE id = 'a0000000-0000-4000-8000-000000000002';

INSERT INTO public.work_experiences (profile_id, job_title, company, dates, description)
SELECT 'a0000000-0000-4000-8000-000000000002',
       'Teaching Assistant', 'Concordia University', '2025 - 2026',
       'Led lab sessions and graded assignments for an intro programming course.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.work_experiences
  WHERE profile_id = 'a0000000-0000-4000-8000-000000000002'
);

INSERT INTO public.education (profile_id, school, degree, years)
SELECT 'a0000000-0000-4000-8000-000000000002',
       'Concordia University', 'BEng Software Engineering', '2024 - 2028'
WHERE NOT EXISTS (
  SELECT 1 FROM public.education
  WHERE profile_id = 'a0000000-0000-4000-8000-000000000002'
);

INSERT INTO public.skills (profile_id, name)
VALUES
  ('a0000000-0000-4000-8000-000000000002', 'Python'),
  ('a0000000-0000-4000-8000-000000000002', 'React'),
  ('a0000000-0000-4000-8000-000000000002', 'SQL')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Jobs (9 published + 1 draft), owned by the demo recruiter
-- ---------------------------------------------------------------------------

INSERT INTO public.jobs
  (recruiter_id, title, company_name, location, category, description,
   required_skills, min_salary, max_salary, status)
SELECT 'a0000000-0000-4000-8000-000000000001',
       v.title, v.company_name, v.location, v.category, v.description,
       v.required_skills, v.min_salary, v.max_salary, v.status
FROM (VALUES
  ('Junior Frontend Developer', 'Northwind Labs', 'Montreal, QC', 'Software',
   'Build accessible React interfaces for a logistics dashboard.',
   ARRAY['React','JavaScript','CSS'], 60000, 75000, 'published'),
  ('Backend Developer (Python)', 'Maple Systems', 'Toronto, ON', 'Software',
   'Design and maintain Flask APIs backed by PostgreSQL.',
   ARRAY['Python','Flask','PostgreSQL'], 80000, 105000, 'published'),
  ('Software Engineering Intern', 'Maple Systems', 'Remote (Canada)', 'Software',
   'Four-month internship on the platform team. Mentorship included.',
   ARRAY['Git','Python'], 22000, 30000, 'published'),
  ('Data Analyst', 'Lumen Analytics', 'Montreal, QC', 'Data',
   'Turn raw product data into dashboards and weekly insights.',
   ARRAY['SQL','Excel','Tableau'], 65000, 85000, 'published'),
  ('UX Designer', 'Brightpath', 'Ottawa, ON', 'Design',
   'Own the design of our onboarding flow, from research to hi-fi prototypes.',
   ARRAY['Figma','User Research'], 70000, 90000, 'published'),
  ('DevOps Engineer', 'Cloudline', 'Vancouver, BC', 'Infrastructure',
   'Run CI/CD pipelines and keep our cloud environments reliable.',
   ARRAY['Docker','CI/CD','AWS'], 95000, 125000, 'published'),
  ('Marketing Coordinator', 'Brightpath', 'Montreal, QC', 'Marketing',
   'Plan campaigns, manage social channels and report on results.',
   ARRAY['Copywriting','Analytics'], 48000, 60000, 'published'),
  ('QA Tester', 'Northwind Labs', 'Remote (Canada)', 'Software',
   'Write and run test plans for web releases; report and track bugs.',
   ARRAY['Testing','Jira'], 55000, 70000, 'published'),
  ('Customer Support Specialist', 'Lumen Analytics', 'Quebec City, QC', 'Support',
   'Help customers succeed with our product by phone and chat.',
   ARRAY['Communication'], NULL, NULL, 'published'),
  ('Senior Product Manager', 'Cloudline', 'Toronto, ON', 'Product',
   'DRAFT - not visible in job search until published.',
   ARRAY['Roadmapping','Stakeholder management'], 120000, 150000, 'draft')
) AS v(title, company_name, location, category, description,
       required_skills, min_salary, max_salary, status)
WHERE NOT EXISTS (
  SELECT 1 FROM public.jobs AS j
  WHERE j.title = v.title AND j.company_name = v.company_name
);

-- ---------------------------------------------------------------------------
-- 4. One sample application so the tracking page has something to show
-- ---------------------------------------------------------------------------

INSERT INTO public.applications (applicant_id, job_id, cover_letter, status)
SELECT 'a0000000-0000-4000-8000-000000000002', j.id,
       'I would love to join the team - I enjoy building React interfaces.',
       'Under Review'
FROM public.jobs AS j
WHERE j.title = 'Junior Frontend Developer' AND j.company_name = 'Northwind Labs'
ON CONFLICT (applicant_id, job_id) DO NOTHING;
