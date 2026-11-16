# Sprint 3 — Issue #97: Recruiter Role at Sign-Up (Backend)

## Scope

This change implements the backend portion of [GitHub issue #97](https://github.com/hatem-ibrahimm/soen341/issues/97) without altering the database migrations or frontend code.

- `POST /api/auth/register`: accepts an optional `role` (`job_seeker` by default, or `recruiter`) and optional `company_name` (for recruiters). Passes `role`, `first_name`, `last_name`, and for recruiter accounts `company_name` in Supabase `options.data`.
- `POST /api/auth/login`: includes `user.role` in the success response.
- `GET /api/auth/me`: includes `user.role` in the authenticated-user response.
- Recruiter job-posting and applicant-management routes recognize accounts that have a row in `public.recruiters`, as well as legacy accounts with trusted Supabase `app_metadata` recruiter roles.

## Registration example

`POST /api/auth/register`

```json
{
  "email": "recruiter@example.test",
  "password": "UseAStrongTestPassword123!",
  "first_name": "Alex",
  "last_name": "Smith",
  "role": "recruiter",
  "company_name": "Example Company"
}
```

The recruiter database row is **not inserted by Flask**. It is created by the existing `on_auth_recruiter_created` database trigger, if that migration is deployed. Supabase may require the user to confirm their email before login.

Role values are exactly `job_seeker` or `recruiter`. A missing role defaults to `job_seeker`. Nonempty `company_name` is accepted only for recruiter signup and is limited to 160 characters. Legacy signup clients that omit `role` continue to work.

## Login and `/api/auth/me` response shape

```json
{
  "user": {
    "id": "<authenticated Supabase user UUID>",
    "email": "recruiter@example.test",
    "role": "recruiter"
  }
}
```

Login also returns the existing `session` and `message` keys; `/api/auth/me` has only `user`.

## Authorization and security

`role` is a **sign-up choice**, not proof of privileges on subsequent requests. After the user exists, recruiter authorization requires either:

1. A server-trusted `app_metadata.role = recruiter` (or recruiter in `app_metadata.roles`) for legacy accounts, **or**
2. An existing row in `public.recruiters` matching the authenticated Supabase user ID.

`user_metadata` and request JSON are **never used directly** to authorize access to recruiter APIs. The migration creates the recruiter row only when a new auth user is inserted; editing user metadata later does not create the row. Because recruiter registration is self-service, any user can **choose** to register as a recruiter; this is not employer verification.

The Flask backend checks `public.recruiters` using its existing server-side PostgreSQL connection (`DATABASE_URL`). When a role query fails, the API fails closed with a `503` rather than silently treating the caller as a job seeker or granting access. Both recruiter API families share the role resolution logic, and existing `jobs.recruiter_id` ownership checks remain in place.

## Database dependencies

These migrations are included in the uploaded repository snapshot and **must be applied to the connected Supabase database**:

- `supabase/migrations/20261115090114_sprint3_recruiters.sql`
- `supabase/migrations/20261115100408_sprint3_recruiters_align.sql`

This implementation does not run those migrations or create new ones.

## Testing / CI

From `backend/`, run:

```powershell
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt
python -m pytest tests/test_auth.py tests/test_recruiter_postings.py tests/test_recruiter_applicants.py -v
python -m pytest tests/ -v
```

The existing `.github/workflows/backend-tests.yml` discovers these tests on pull requests targeting `develop`. Do not claim tests pass until CI or a local run confirms it.

### Live verification cases

1. Register a new recruiter account with optional company information and verify the row exists in `public.recruiters` (using an authorized database administrator).
2. Complete email confirmation if required, then log in; check `user.role = "recruiter"`.
3. Call `GET /api/auth/me` using the access token; check role.
4. Use the same account to list/create its recruiter job postings; confirm success on its own resources.
5. Register a regular job seeker; verify `user.role = "job_seeker"` and recruiter endpoints reject access.
6. Verify existing administrator-provisioned recruiters remain authorized.
7. Attempt malformed roles, user-supplied role fields on login, and user-metadata role spoofing; verify access is denied without a trusted recruiter record.

**No live Supabase integration, email confirmation, or complete pytest run was performed during preparation of these files.**
