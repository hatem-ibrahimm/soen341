# Sprint 3 — Issue #79: Job Application Analytics API

This is a **read-only** endpoint for CareerConnect job seekers. It uses
Supabase Auth (through the existing `get_current_user`) and PostgreSQL
(through the existing `get_connection`). No changes to database migrations.

## Endpoint

`GET /api/analytics/applications`

**Authentication:** `Authorization: Bearer <Supabase access token>`

### Successful response (200)

```json
{
  "total_applications": 5,
  "by_status": {
    "Applied": 1,
    "Under Review": 2,
    "Interview": 1,
    "Offered": 1,
    "Rejected": 0
  }
}
```

If the job seeker has not submitted any applications, the endpoint returns
`total_applications: 0` and all five counts as `0`. All five status keys are
always present, regardless of counts.

### Errors

- `401`: missing, expired, or invalid bearer token.
- `500`: database unavailable, unexpected schema/data, or invalid trusted user ID.
  Internal database error details are not returned to the API caller.

### Security and data contract

The client **does not** choose an applicant ID; the backend derives it from
Supabase Auth. SQL uses `WHERE applicant_id = %s` with a bound parameter.
The query counts rows in `public.applications` and does not expose applications
of other job seekers. This remains important because `DATABASE_URL` may bypass
Supabase Row Level Security, depending on the connection role.

Matches `supabase/migrations/20261026120200_sprint2_jobs_applications.sql`:
- `applications.applicant_id` is UUID
- `applications.status` is constrained to `Applied`, `Under Review`,
  `Interview`, `Offered`, `Rejected`
- Application counts use existing records and their *current* status

This endpoint deliberately does **not** compute weekly/monthly trends, date
ranges, or individual application history; those belong to Sprint 3 Issue 3.

## Integration

`app.py` adds a call to:

```python
register_application_analytics_routes(app, get_connection, get_current_user)
```

The API response format should be confirmed with Cristina before connecting
chart components. No frontend or database migration files were changed.

## Tests

From repository `backend/` directory:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest tests/test_application_analytics.py -v
python -m pytest tests/ -v
```

The existing `.github/workflows/backend-tests.yml` runs all files under
`backend/tests/`; a separate workflow change is **not required**.

### Proposed acceptance-test GitHub issues

**AT 1 — Authenticated analytics:** Given an authenticated job seeker with
five application records in known statuses, when they call the endpoint,
then the total is five and the per-status counts match the database.

**AT 2 — Privacy and empty state:** Given two job seekers and an empty
application history for one, when the second user requests analytics,
then only their own records are counted; a zero-application user sees zero
counts in every status. Without authentication, the API returns 401.

These tests are *proposals*, not proof of deployed Supabase integration.

## Verification limitations

The Python syntax and file-level changes can be checked offline. Backend unit
tests and live database access require an environment with Flask and the
repository's Python dependencies installed. Do not mark the GitHub PR testing
boxes as passed without evidence from local tests or GitHub Actions.
