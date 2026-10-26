import { request, USE_MOCK_API } from './apiClient.js'
import { getJob, listJobs } from './jobsApi.js'
import { delay, MOCK_JOBS, newId, readDb, writeDb } from './mockStore.js'

// Job applications. Backend routes:
//   POST /api/applications       { job_id, resume_id, cover_letter }  -> 201 { application }
//                                409 if already applied
//   GET  /api/applications       -> { applications: [...], pagination }  (newest first)
//   GET  /api/applications/<id>  -> { application }
// The backend sends { id, job_id, resume_id, status, submitted_at }.
// toApplication() renames submitted_at to applied_at and adds the fields our pages use.

export const COVER_LETTER_MAX = 2000

function toApplication(raw, job = null, extra = {}) {
    // The backend does not store a status history yet, so we build a simple one:
    // the date it was applied, plus the current status (date unknown).
    const history = [{ status: 'Applied', changed_at: raw.submitted_at }]
    if (raw.status !== 'Applied') history.push({ status: raw.status, changed_at: null })
    return {
        id: String(raw.id),
        job_id: String(raw.job_id),
        resume_id: raw.resume_id,
        status: raw.status,
        applied_at: raw.submitted_at,
        status_history: history,
        cover_letter: raw.cover_letter ?? '',
        job,
        ...extra,
    }
}

function withMockJob(app) {
    return { ...app, job: MOCK_JOBS.find((j) => j.id === app.job_id) ?? null }
}

export async function submitApplication(payload) {
    if (USE_MOCK_API) {
        const db = readDb()
        if (db.applications.some((a) => a.job_id === payload.job_id)) {
            throw new Error('You have already applied to this job.')
        }
        const now = new Date().toISOString()
        const application = {
            id: newId('app'),
            ...payload,
            status: 'Applied',
            applied_at: now,
            status_history: [{ status: 'Applied', changed_at: now }],
        }
        db.applications.unshift(application)
        writeDb(db)
        return delay(withMockJob(application), 500)
    }
    const data = await request('/api/applications', {
        method: 'POST',
        body: {
            job_id: payload.job_id,
            resume_id: payload.resume_id ? String(payload.resume_id) : null,
            cover_letter: payload.cover_letter,
        },
    })
    const job = await getJob(payload.job_id).catch(() => null)
    return toApplication(data.application, job, { cover_letter: payload.cover_letter })
}

export async function listMyApplications() {
    if (USE_MOCK_API) {
        const apps = readDb().applications.map(withMockJob)
        apps.sort((a, b) => b.applied_at.localeCompare(a.applied_at))
        return delay(apps)
    }
    // Load the applications and the job list together, then attach each job's details.
    const [data, jobs] = await Promise.all([
        request('/api/applications?limit=100'),
        listJobs().catch(() => []),
    ])
    const jobsById = new Map(jobs.map((j) => [j.id, j]))
    return (data.applications ?? []).map((raw) =>
        toApplication(raw, jobsById.get(String(raw.job_id)) ?? null),
    )
}

export async function getApplication(id) {
    if (USE_MOCK_API) {
        const app = readDb().applications.find((a) => a.id === id)
        if (!app) throw new Error('Application not found.')
        return delay(withMockJob(app))
    }
    const data = await request(`/api/applications/${id}`)
    const job = await getJob(data.application.job_id).catch(() => null)
    return toApplication(data.application, job)
}

// Used by the apply page to block a second application to the same job.
export async function findApplicationForJob(jobId) {
    const apps = await listMyApplications()
    return apps.find((a) => String(a.job_id) === String(jobId)) ?? null
}
