-- Keep only the latest generated feedback for each uploaded resume.
BEGIN;

CREATE TABLE IF NOT EXISTS public.resume_feedback (
  resume_id uuid PRIMARY KEY
    REFERENCES public.resumes(id) ON DELETE CASCADE,
  resume_updated_at timestamptz NOT NULL,
  strengths jsonb NOT NULL
    CHECK (jsonb_typeof(strengths) = 'array'),
  areas_for_improvement jsonb NOT NULL
    CHECK (jsonb_typeof(areas_for_improvement) = 'array'),
  recommendations jsonb NOT NULL
    CHECK (jsonb_typeof(recommendations) = 'array'),
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resume_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.resume_feedback FROM anon, authenticated;

COMMIT;
