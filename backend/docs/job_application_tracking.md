# Sprint 2 – Issue #42: Job Application Tracking API (Parsa)

**GitHub task:** #42 – Implement Job Application Tracking API.
**Dependency:** #41 – Job Application Submission API (`POST /api/applications`).

This change adds application-listing, application-detail, and recruiter-owned status-update endpoints. It does **not** change the frontend, existing profile/resume handlers, Issue #41's submission logic, or Hatem's migrations.

## Files

- `backend/src/main/application_tracking.py` – new Flask routes.
- `backend/src/main/app.py` – registers those routes with existing `get_connection()` and `get_current_user()` helpers; existing endpoints unchanged.
- `backend/tests/test_application_tracking.py` – isolated unit tests using mocked Supabase Auth and PostgreSQL connections.
- `backend/docs/job_application_tracking.md` – API and provisional schema contract.

## API endpoints

All endpoints require `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`.

### GET `/api/applications`

Lists only applications where `applications.applicant_id` matches the authenticated job seeker. Most recent first.

Optional query parameters:
- `status` – one of `Applied`, `Under Review`, `Interview`, `Offered`, `Rejected` (case-sensitive).
- `limit` – 1 to 100; default 20.
- `offset` – 0 to 100000; default 0.

Response: HTTP 200:

```json
{
  "applications": [
    {
      "id": "e4be1505-c45b-4f1c-9068-8dbd91a86dd5",
      "applicant_id": "550e8400-e29b-41d4-a716-446655440000",
      "job_id": "8cb0abe6-2c39-45dc-a700-3cf2bd28592b",
      "resume_id": null,
      "status": "Applied",
      "submitted_at": "2026-10-25T20:00:00+00:00"
    }
  ],
  "pagination": { "limit": 20, "offset": 0, "has_more": false }
}
```

### GET `/api/applications/<application_id>`

Fetches an application **only if it belongs to the authenticated job seeker**. Returns HTTP 200 with `{"application": { ... }}`. Returns HTTP 404 for unknown applications *and* applications owned by another account, without revealing their existence.

### PATCH `/api/applications/<application_id>/status`

Changes status **only when the authenticated user is the recruiter who owns the associated job**. Expected request:

```json
{ "status": "Interview" }
```

Responds HTTP 200 with a confirmation and updated application record. Authorization happens inside the parameterized PostgreSQL UPDATE using `jobs.recruiter_id`; a different account cannot update a posting it does not own. A missing/unauthorized application produces 404 to avoid disclosing another recruiter's data.

For all routes: HTTP 401 for missing/invalid Supabase token, 400 for invalid IDs, JSON, or status, 500 for backend/database errors. Read operations do not modify stored statuses.

This initial implementation allows any transition among the five approved values; approval of transition rules (if any) is a team/product decision.

## Required database contract — **NOT YET VERIFIED**

The supplied `develop (8)` ZIP does **not** include Hatem's tables for jobs and applications. The SQL in this issue expects:

```text
public.applications
  id           uuid primary key
  applicant_id uuid   -- the authenticated Supabase user ID
  job_id       uuid   -- FK to jobs.id
  resume_id    uuid nullable
  status       text   -- Applied | Under Review | Interview | Offered | Rejected
  created_at   timestamptz

public.jobs
  id           uuid primary key
  recruiter_id uuid   -- owner of the posting, equal to Supabase Auth user ID
```

**Must coordinate with Hatem before merging:**

1. Confirm actual table/column names (`jobs`, `applications`, `recruiter_id`, `created_at`) and whether `recruiter_id` references Supabase Auth directly.
2. Confirm application status values match the database constraint/enum exactly.
3. Confirm database access and row-level security for direct server-side PostgreSQL via `DATABASE_URL`; never expose this connection string to the browser.
4. Confirm whether updating status requires an additional recruiter role check. Current query enforces job ownership but does not use a separate roles table; this is adequate only if job ownership is correctly established by protected posting-creation logic.
5. If Hatem defines a different model, adapt **this isolated new module and its tests** rather than changing teammate migrations or feature code.
6. Status-update timestamps/history are not provided by this contract. They would need an agreed schema addition if required for the UI.

## Testing

From the repository root:

```powershell
python -m pip install -r backend/requirements.txt
cd backend
python -m unittest discover -s tests -v
```

The new tests cover authentication, row ownership, paginated listing, status filtering, application details, valid recruiter status updates, denied updates, validation failures, and database error handling. These use mocks and **do not prove deployed Supabase/Postgres integration**.

### Manual validation after database schema integration

1. With applicant A's bearer token, `GET /api/applications` lists only A's applications.
2. `GET /api/applications?status=Interview` filters correctly; query paging is consistent.
3. With applicant B's token, requesting A's application ID returns 404.
4. With the posting owner's recruiter token, `PATCH /api/applications/<id>/status` with `{"status":"Interview"}` returns 200 and persists the change.
5. With an unrelated account's token, the same PATCH returns 404 and leaves status unchanged.
6. Invalid status (e.g. `Hired`) returns 400 without touching the database.
7. Rerun Sprint 1 and Issue #41 backend tests for regression checks.

## Proposed GitHub acceptance-test issues

The instructor requires at least **two acceptance-test GitHub issues per user story**, labeled and linked to their parent user story/tasks. Suggested scenarios:

- **AT: Job seeker views tracked applications** – Given a logged-in applicant with two submitted applications, when requesting their tracking list, then only their applications appear with current statuses and submission dates. Other users cannot read them.
- **AT: Recruiter updates application status** – Given a recruiter who owns a posting and an application for it, when setting status to `Interview`, then the response succeeds and the applicant can see the new status. An unrelated account's update fails and leaves the status unchanged.

These are proposals, not GitHub issues created automatically.
