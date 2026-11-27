import {request, USE_MOCK_API} from './apiClient.js'
import {delay, newId, readDb, writeDb} from './mockStore.js'
import {getUserId, getUserRole} from './session.js'

function findMockApplication(db, applicationId) {
    const application = (db.applications ?? []).find(
        (item) => String(item.id) === String(applicationId),
    )
    if (!application || application.status !== 'Interview') {
        throw new Error('Interview coordination not found.')
    }
    const job = (db.jobs ?? []).find(
        (item) => String(item.id) === String(application.job_id),
    )
    if (getUserRole() === 'recruiter' && job?.recruiter_id !== getUserId()) {
        throw new Error('Interview coordination not found.')
    }
    return { application, job }
}

function notifyMock(db, applicationId, title, message) {
    db.notifications ??= []
    db.notifications.push({
        id: newId('notification'),
        user_id: getUserId(),
        application_id: String(applicationId),
        type: 'interview_update',
        title,
        message,
        is_read: false,
        created_at: new Date().toISOString(),
    })
}

export async function getInterviewCoordination(applicationId) {
    if (USE_MOCK_API) {
        const db = readDb()
        const { job } = findMockApplication(db, applicationId)
        const coordination = db.interviewCoordination?.[applicationId] ?? {
            options: [],
            messages: [],
        }
        return delay({
            role: getUserRole() === 'recruiter' ? 'recruiter' : 'applicant',
            job_title: job?.title ?? 'Interview',
            company: job?.company ?? job?.company_name ?? '',
            options: coordination.options,
            messages: coordination.messages,
        })
    }
    return request(`/api/applications/${encodeURIComponent(applicationId)}/interview`)
}

export async function proposeInterviewOptions(applicationId, options) {
    if (USE_MOCK_API) {
        if (getUserRole() !== 'job_seeker') throw new Error('Only the job seeker can propose interview options.')
        if (!Array.isArray(options) || options.length < 2 || options.length > 5) {
            throw new Error('Provide between 2 and 5 interview options.')
        }
        const db = readDb()
        findMockApplication(db, applicationId)
        db.interviewCoordination ??= {}
        const coordination = db.interviewCoordination[applicationId] ?? {
            options: [],
            messages: [],
        }
        coordination.options.push(...options.map((proposedAt) => ({
            id: newId('option'),
            proposed_at: proposedAt,
            proposed_by: getUserId(),
            is_final: false,
            created_at: new Date().toISOString(),
        })))
        db.interviewCoordination[applicationId] = coordination
        notifyMock(db, applicationId, 'Interview times suggested', 'The job seeker suggested interview times for your review.')
        writeDb(db)
        return delay(coordination.options)
    }
    return await request(
        `/api/applications/${encodeURIComponent(applicationId)}/interview/options`,
        {method: 'POST', body: {options}},
    )
}

export async function sendInterviewMessage(applicationId, message) {
    if (USE_MOCK_API) {
        const db = readDb()
        findMockApplication(db, applicationId)
        db.interviewCoordination ??= {}
        const coordination = db.interviewCoordination[applicationId] ?? {
            options: [],
            messages: [],
        }
        const created = {
            id: newId('message'),
            sender_id: getUserId(),
            message,
            created_at: new Date().toISOString(),
        }
        coordination.messages.push(created)
        db.interviewCoordination[applicationId] = coordination
        notifyMock(db, applicationId, 'New interview message', 'You received a new message about interview scheduling.')
        writeDb(db)
        return delay(created)
    }
    const data = await request(
        `/api/applications/${encodeURIComponent(applicationId)}/interview/messages`,
        { method: 'POST', body: { message } },
    )
    return data.message
}

export async function finalizeInterviewOption(applicationId, optionId) {
    if (USE_MOCK_API) {
        if (getUserRole() !== 'recruiter') throw new Error('Only the recruiter can confirm an interview time.')
        const db = readDb()
        findMockApplication(db, applicationId)
        const coordination = db.interviewCoordination?.[applicationId]
        const option = coordination?.options.find((item) => String(item.id) === String(optionId))
        if (!option) throw new Error('Interview option not found.')
        coordination.options = coordination.options.map((item) => ({
            ...item,
            is_final: String(item.id) === String(optionId),
        }))
        notifyMock(db, applicationId, 'Interview time confirmed', 'The final interview time was confirmed.')
        writeDb(db)
        return delay(option)
    }
    return await request(
        `/api/applications/${encodeURIComponent(applicationId)}/interview/options/${encodeURIComponent(optionId)}/final`,
        {method: 'PATCH'},
    )
}
