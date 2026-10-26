import { request, USE_MOCK_API } from './apiClient.js'
import { delay, MOCK_JOBS, newId, readDb, writeDb } from './mockStore.js'

// Job applications. Backend routes:
//   POST /api/applications       { job_id, resume_id, cover_letter, email, phone_number }
//                                -> 201 { application }   409 if already applied
//   GET  /api/applications       -> { applications: [...] }   (current user's, newest first)
//   GET  /api/applications/<id>  -> { application }
// application = { id, job_id, job: {title, company, location}, resume_id, cover_letter,
//                 status, applied_at, status_history: [{ status, changed_at }] }

function withJob(app) {
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
        return delay(withJob(application), 500)
    }
    const data = await request('/api/applications', { method: 'POST', body: payload })
    return data.application
}

export async function listMyApplications() {
    if (USE_MOCK_API) {
        const apps = readDb().applications.map(withJob)
        apps.sort((a, b) => b.applied_at.localeCompare(a.applied_at))
        return delay(apps)
    }
    const data = await request('/api/applications')
    return data.applications
}

export async function getApplication(id) {
    if (USE_MOCK_API) {
        const app = readDb().applications.find((a) => a.id === id)
        if (!app) throw new Error('Application not found.')
        return delay(withJob(app))
    }
    const data = await request(`/api/applications/${id}`)
    return data.application
}

// Used by the apply page to block a second application to the same job.
export async function findApplicationForJob(jobId) {
    const apps = await listMyApplications()
    return apps.find((a) => a.job_id === jobId) ?? null
}
