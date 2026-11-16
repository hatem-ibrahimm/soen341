# Sprint 3 — Recruiter Applicant Management API

**Scope:** Backend read-only applicant listing and detail for job postings owned by an authenticated recruiter. This is the first of Parsa's Sprint 3 issues. It extends the existing recruiter job posting (Issue #43) and application tracking (Issue #42) endpoints.

## Endpoints

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/recruiter/jobs/<job_id>/applications` | Applications received for one owned job; supports `status`, `limit`, `offset` |
| `GET` | `/api/recruiter/applications/<application_id>` | Applicant/application details for a job owned by the recruiter, including cover letter |

All requests require `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`.

**Security:** Role is granted only from trusted Supabase `app_metadata.role == "recruiter"` or `app_metadata.roles` containing `"recruiter"`, reusing the existing `_recruiter_id()` helper from `recruiter_postings.py`. Client-provided roles and `user_metadata` do not grant access. Both queries restrict results to `jobs.recruiter_id` matching the authenticated user. Requests for records owned by another recruiter return 404. The response contains only candidate name/email, resume file name and ID, application status and timestamps; it does **not** expose raw resume storage paths or a public resume download URL.

### List example

```http
GET /api/recruiter/jobs/42/applications?status=Under%20Review&limit=20&offset=0
Authorization: Bearer <TOKEN>
```

A successful `200` response has:

```json
{
  "applications": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "applicant_id": "11111111-1111-4111-8111-111111111111",
      "job_id": 42,
      "resume_id": "33333333-3333-4333-8333-333333333333",
      "status": "Under Review",
      "submitted_at": "2026-11-10T14:30:00+00:00",
      "applicant": {
        "id": "11111111-1111-4111-8111-111111111111",
        "first_name": "Alex",
        "last_name": "Candidate",
        "email": "alex@example.test"
      },
      "resume": {
        "id": "33333333-3333-4333-8333-333333333333",
        "file_name": "resume.pdf"
      }
    }
  ],
  "pagination": {"limit": 20, "offset": 0, "has_more": false}
}
```

The list response excludes the full cover letter. If the recruiter needs it, call the detail endpoint.

### Detail example

```http
GET /api/recruiter/applications/22222222-2222-4222-8222-222222222222
Authorization: Bearer <TOKEN>
```

Returns `{ "application": { ... } }` with the same fields plus `cover_letter` (string or null).

### Query parameters

- `status` (optional): case-sensitive `Applied`, `Under Review`, `Interview`, `Offered`, or `Rejected`.
- `limit` (optional): integer 1–100, default 20.
- `offset` (optional): integer 0–100000, default 0.
- Results order: most recent application first; ties break on application ID descending.
- An owned job with no applications returns HTTP 200 and an empty `applications` list; a missing/unowned job returns HTTP 404.

### Error statuses

- `400` invalid job/application ID or query parameter.
- `401` missing/invalid authentication.
- `403` authenticated user is not a recruiter.
- `404` job/application not found or not owned by recruiter.
- `500` database query failed (server logs the underlying exception).

## Database dependencies (from repository migration)

`supabase/migrations/20261026120200_sprint2_jobs_applications.sql` defines:
- `public.jobs.id`: BIGINT; `public.jobs.recruiter_id`: UUID.
- `public.applications.id`: UUID; `applicant_id`: UUID; `job_id`: BIGINT; `resume_id`: UUID nullable; `status`: text; `cover_letter`: text nullable; `created_at`: timestamp with time zone.

Existing profile and resume migrations supply `public.profiles(id, first_name, last_name, email)` and `public.resumes(id, file_name)`. All SQL uses parameterized values and the existing `get_connection()` factory.

**Live deployment check still needed:** Confirm these migrations are applied to the Supabase environment used in the demo and that the PostgreSQL connection has SELECT privileges for the related tables. The development team must provision recruiter roles in trusted Supabase `app_metadata`. The migrations alone do not provision recruiter users.

The feature deliberately does not add a resume download route, status mutation, notification delivery, or frontend screen. Recruiter status updates remain handled by Issue #42: `PATCH /api/applications/<application_id>/status`.

## Testing / CI

From `backend/`:

```powershell
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt
python -m pytest tests/ -v
```

CI's `.github/workflows/backend-tests.yml` already runs `python -m pytest tests/ -v`; adding `test_recruiter_applicants.py` to `backend/tests/` is sufficient. Do not change Ariana's CI workflow unless results demonstrate a problem.

## Acceptance-test issue suggestions

1. **AT-S3-RA-01: Owned recruiter can list/filter applicants.** Given an authenticated recruiter and a job they own with applications in several statuses, when the recruiter requests applicant lists with a status filter and pagination, then only matching applications are returned with correct applicant details.
2. **AT-S3-RA-02: Other recruiters cannot access applicants.** Given a recruiter who does not own a job or application, when they request its applicant list or details, then the API responds 404 without exposing applicant information; unauthenticated and job seeker requests are rejected.

These acceptance-test scenarios must be created as GitHub issues and linked to the team's Sprint 3 parent user story and development task, as required by course guidelines.
