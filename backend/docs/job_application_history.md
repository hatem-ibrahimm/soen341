# Sprint 3 Issue #80 — Application History and Activity Metrics API

## Purpose

Provide read-only application history and timeline chart data for the authenticated job seeker. This extends Issue #79's application status summary rather than replacing it.

## Authentication

Both endpoints require `Authorization: Bearer <Supabase access token>`.
The caller's user ID is verified by the existing `get_current_user()` helper; the ID is *not* taken from client parameters. SQL queries include `a.applicant_id = %s`. Invalid or missing tokens return `401`.

## GET /api/analytics/applications/history

Optional query parameters:

| Parameter | Meaning |
|---|---|
| `start_date` | UTC calendar date `YYYY-MM-DD` (inclusive) |
| `end_date` | UTC calendar date `YYYY-MM-DD` (inclusive) |
| `status` | Exact status: `Applied`, `Under Review`, `Interview`, `Offered`, or `Rejected` |
| `limit` | 1–100, default 20 |
| `offset` | 0–100000, default 0 |

Example:

```http
GET /api/analytics/applications/history?start_date=2026-11-01&end_date=2026-11-30&limit=20
Authorization: Bearer <access_token>
```

Response (`200`):

```json
{
  "history": [
    {
      "id": "a5b8da0a-6000-4cd7-a677-cc12eb21df66",
      "job_id": 42,
      "job_title": "Backend Developer",
      "company_name": "Example Inc.",
      "status": "Applied",
      "submitted_at": "2026-11-12T16:30:00+00:00"
    }
  ],
  "pagination": {"limit": 20, "offset": 0, "has_more": false}
}
```

The API sorts newest first by `(a.created_at DESC, a.id DESC)` and returns one extra row internally to determine `has_more`, without leaking another user's application data. A user with no records receives `history: []`.

## GET /api/analytics/applications/activity

Optional query parameters:

| Parameter | Meaning |
|---|---|
| `group_by` | `week` or `month`, default `month` |
| `start_date` | UTC calendar date `YYYY-MM-DD` (inclusive) |
| `end_date` | UTC calendar date `YYYY-MM-DD` (inclusive) |

Example:

```http
GET /api/analytics/applications/activity?group_by=month&start_date=2026-11-01
Authorization: Bearer <access_token>
```

Response (`200`):

```json
{
  "group_by": "month",
  "total_applications": 5,
  "periods": [
    {"period_start": "2026-11-01", "applications": 2},
    {"period_start": "2026-12-01", "applications": 3}
  ]
}
```

`week` buckets start on Monday. Counts represent **submitted applications**, regardless of their current status. Date filtering is applied before aggregation. Periods with no applications are omitted; the frontend may fill gaps with zeros for charts. An empty dataset yields `total_applications: 0` and `periods: []`.

## Error responses

- `400`: invalid date, reversed date range, unsupported status/grouping, or invalid pagination.
- `401`: missing/invalid Supabase bearer token.
- `500`: database failure or unexpectedly malformed authenticated user/rows. Details are logged server-side but not exposed in the response.

## Database contract

Uses existing tables from `supabase/migrations/20261026120200_sprint2_jobs_applications.sql`:

- `public.applications`: `id` (UUID), `applicant_id` (UUID), `job_id` (bigint), `status` (text), `created_at` (timestamptz)
- `public.jobs`: `id` (bigint), `title`, `company_name`

No new migrations or schema updates are required. `get_connection()` uses the repository's `DATABASE_URL` PostgreSQL connection. Timestamps are filtered using half-open UTC boundaries so that `end_date` includes the entire specified date.

## Team integration

- Cristina: the history response is a ready-to-render list; activity `periods` is an ascending chart series. Display UTC dates or convert explicitly in the UI. Handle `pagination.has_more` for pagination.
- Hatem: confirm the latest deployed schema matches the migration and contains the expected columns and permissions.
- Parsa: verify authentication and per-user data isolation in live API tests; do not claim full integration from mocked tests alone.

## Verification

Run from `backend/`:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest tests/test_application_history.py -v
python -m pytest tests/ -v
```

The GitHub Actions `backend-tests.yml` workflow already runs `python -m pytest tests/ -v`, so the new file should be discovered automatically. Confirm the actual CI result in GitHub Actions after pushing.

### Proposed acceptance-test GitHub issues

1. Authenticated job seeker submits multiple applications on different dates; a date-filtered history request returns only their matching applications in newest-first order with job/company/status details. Another job seeker's applications must never appear.
2. Authenticated job seeker requests weekly and monthly activity; counts match their submitted application records for the selected UTC date range, and a job seeker with no applications gets zero total and an empty `periods` array.

These are **proposals** until created as linked GitHub issues and executed.
