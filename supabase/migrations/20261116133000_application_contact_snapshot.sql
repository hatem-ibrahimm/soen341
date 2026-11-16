-- Preserve the contact details supplied with each application.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

UPDATE public.applications AS a
SET contact_email = p.email,
    contact_phone = p.phone_number
FROM public.profiles AS p
WHERE p.id = a.applicant_id
  AND (a.contact_email IS NULL OR a.contact_phone IS NULL);
