import { request, USE_MOCK_API } from './apiClient.js'
import { delay, newId, readDb, writeDb } from './mockStore.js'
import { getUserId } from './session.js'

function isOwnedApplication(db, applicationId) {
    const application = (db.applications ?? []).find(
        (item) => String(item.id) === String(applicationId),
    )
    return Boolean(
        application &&
        (db.jobs ?? []).some(
            (job) =>
                String(job.id) === String(application.job_id) &&
                String(job.recruiter_id) === String(getUserId()),
        ),
    )
}

export async function listMyInterviews() {
    if (USE_MOCK_API) {
        const db = readDb()
        const applicationIds = new Set(
            (db.applications ?? []).map((application) => String(application.id)),
        )
        return delay((db.interviews ?? []).filter(
            (interview) => applicationIds.has(String(interview.application_id)),
        ))
    }
    const data = await request('/api/applications/interviews')
    return data.interviews ?? []
}

export async function listRecruiterInterviews(applicationId) {
    if (USE_MOCK_API) {
        const db = readDb()
        if (!isOwnedApplication(db, applicationId)) throw new Error('Application not found.')
        return delay((db.interviews ?? []).filter(
            (interview) => String(interview.application_id) === String(applicationId),
        ))
    }
    const data = await request(
        `/api/recruiter/applications/${encodeURIComponent(applicationId)}/interviews`,
    )
    return data.interviews ?? []
}

export async function scheduleRecruiterInterview(applicationId, interview) {
    if (USE_MOCK_API) {
        const db = readDb()
        if (!isOwnedApplication(db, applicationId)) throw new Error('Application not found.')
        db.interviews ??= []
        const created = {
            id: newId('interview'),
            application_id: String(applicationId),
            ...interview,
            status: 'scheduled',
            created_at: new Date().toISOString(),
        }
        db.interviews.push(created)
        writeDb(db)
        return delay(created)
    }
    const data = await request(
        `/api/recruiter/applications/${encodeURIComponent(applicationId)}/interviews`,
        { method: 'POST', body: interview },
    )
    return data.interview
}

export async function updateRecruiterInterview(applicationId, interviewId, status) {
    if (USE_MOCK_API) {
        const db = readDb()
        if (!isOwnedApplication(db, applicationId)) throw new Error('Application not found.')
        const interview = (db.interviews ?? []).find(
            (item) =>
                String(item.id) === String(interviewId) &&
                String(item.application_id) === String(applicationId),
        )
        if (!interview) throw new Error('Interview not found.')
        interview.status = status
        writeDb(db)
        return delay(interview)
    }
    const data = await request(
        `/api/recruiter/applications/${encodeURIComponent(applicationId)}/interviews/${encodeURIComponent(interviewId)}`,
        { method: 'PATCH', body: { status } },
    )
    return data.interview
}
