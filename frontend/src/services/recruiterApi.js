import {request, USE_MOCK_API} from './apiClient.js'
import {getUserId} from './session.js'
import {delay, MOCK_JOBS, newId, readDb, writeDb} from './mockStore.js'
import {toJob} from './jobsApi.js'

function formatSalary(min, max) {
    const format = (amount) =>
        `$${Number(amount).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`

    if (min != null && max != null) return `${format(min)} – ${format(max)}`
    if (min != null) return `From ${format(min)}`
    if (max != null) return `Up to ${format(max)}`
    return ''
}

export async function createJobListing(listing) {
    if (USE_MOCK_API) {
        const db = readDb()
        const job = {
            id: newId('job'),
            ...listing,
            company: listing.company_name,
            type: listing.category,
            salary: formatSalary(listing.min_salary, listing.max_salary),
            posted_at: new Date().toISOString(),
            recruiter_id: getUserId(),
        }
        db.jobs = [...(db.jobs ?? MOCK_JOBS), job]
        writeDb(db)
        return delay(job)
    }

    const data = await request('/api/recruiter/jobs', {
        method: 'POST',
        body: listing,
    })
    const job = toJob(data.job ?? data)

    if (!job?.id) {
        throw new Error('The server did not return the created job listing.')
    }

    return job
}

export async function listRecruiterJobs() {
    if (USE_MOCK_API) {
        const recruiterId = getUserId()
        const jobs = (readDb().jobs ?? MOCK_JOBS).filter(
            (job) => job.recruiter_id === recruiterId,
        )
        return delay(jobs)
    }

    const jobs = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
        const data = await request(
            `/api/recruiter/jobs?limit=100&offset=${offset}`,
        )
        const page = data.jobs ?? []
        jobs.push(...page.map(toJob))
        hasMore = Boolean(data.pagination?.has_more && page.length)
        offset += page.length
    }

    return jobs
}

export async function updateJobListing(jobId, changes) {
    if (USE_MOCK_API) {
        const db = readDb()
        const index = (db.jobs ?? MOCK_JOBS).findIndex(
            (job) =>
                String(job.id) === String(jobId) &&
                job.recruiter_id === getUserId(),
        )
        if (index < 0) throw new Error('Job posting not found.')

        const jobs = [...(db.jobs ?? MOCK_JOBS)]
        const minimum = Object.hasOwn(changes, 'min_salary')
            ? changes.min_salary
            : jobs[index].min_salary
        const maximum = Object.hasOwn(changes, 'max_salary')
            ? changes.max_salary
            : jobs[index].max_salary
        const updated = {
            ...jobs[index],
            ...changes,
            ...(changes.min_salary !== undefined || changes.max_salary !== undefined
                ? { salary: formatSalary(minimum, maximum) }
                : {}),
            ...(changes.company_name
                ? { company: changes.company_name }
                : {}),
            ...(changes.category ? { type: changes.category } : {}),
        }
        jobs[index] = updated
        db.jobs = jobs
        writeDb(db)
        return delay(updated)
    }

    const data = await request(
        `/api/recruiter/jobs/${encodeURIComponent(jobId)}`,
        { method: 'PATCH', body: changes },
    )
    const job = toJob(data.job)
    if (!job?.id) {
        throw new Error('The server did not return the updated job listing.')
    }
    return job
}

export async function deleteJobListing(jobId) {
    if (USE_MOCK_API) {
        const db = readDb()
        const index = (db.jobs ?? MOCK_JOBS).findIndex(
            (job) =>
                String(job.id) === String(jobId) &&
                job.recruiter_id === getUserId(),
        )
        if (index < 0) throw new Error('Job posting not found.')
        if ((db.jobs ?? MOCK_JOBS)[index].status !== 'archived') {
            throw new Error('Only archived job listings can be deleted.')
        }

        const jobs = [...(db.jobs ?? MOCK_JOBS)]
        jobs.splice(index, 1)
        db.jobs = jobs
        db.applications = (db.applications ?? []).filter(
            (application) => String(application.job_id) !== String(jobId),
        )
        writeDb(db)
        return delay({ id: jobId })
    }

    return await request(
        `/api/recruiter/jobs/${encodeURIComponent(jobId)}`,
        {method: 'DELETE'},
    )
}

export async function listRecruiterApplications(jobId) {
    if (USE_MOCK_API) {
        const db = readDb()
        const ownsJob = (db.jobs ?? []).some(
            (job) => String(job.id) === String(jobId) && job.recruiter_id === getUserId(),
        )
        if (!ownsJob) throw new Error('Job posting not found.')
        const applications = (db.applications ?? [])
            .filter((application) => String(application.job_id) === String(jobId))
            .map((application) => ({
                id: String(application.id),
                job_id: String(application.job_id),
                resume_id: application.resume_id ?? null,
                status: application.status,
                submitted_at: application.applied_at,
                applicant: {
                    id: getUserId(),
                    first_name: db.profile?.first_name ?? '',
                    last_name: db.profile?.last_name ?? '',
                    email: db.profile?.email ?? '',
                },
                resume: db.resumes?.find(
                    (resume) => String(resume.id) === String(application.resume_id),
                ) ?? null,
            }))
        return delay(applications)
    }

    const applications = []
    let offset = 0
    let hasMore = true
    while (hasMore) {
        const data = await request(
            `/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications?limit=100&offset=${offset}`,
        )
        const page = data.applications ?? []
        applications.push(...page)
        hasMore = Boolean(data.pagination?.has_more && page.length)
        offset += page.length
    }
    return applications
}

export async function getRecruiterApplication(applicationId) {
    if (USE_MOCK_API) {
        const db = readDb()
        const application = db.applications.find(
            (item) => String(item.id) === String(applicationId),
        )
        if (!application) throw new Error('Application not found.')
        const listed = (await listRecruiterApplications(application.job_id)).find(
            (item) => String(item.id) === String(applicationId),
        )
        if (!listed) throw new Error('Application not found.')
        return delay({
            ...listed,
            applicant: {
                ...listed.applicant,
                title: db.profile?.title ?? '',
                phone_number: db.profile?.phone_number ?? '',
                location: db.profile?.location ?? '',
                bio: db.profile?.bio ?? '',
            },
            cover_letter: application.cover_letter ?? '',
            experiences: db.experiences ?? [],
            education: db.education ?? [],
            skills: db.skills ?? [],
        })
    }
    const data = await request(
        `/api/recruiter/applications/${encodeURIComponent(applicationId)}`,
    )
    return data.application
}

export async function updateRecruiterApplicationStatus(applicationId, status) {
    if (USE_MOCK_API) {
        const db = readDb()
        const application = db.applications.find(
            (item) => String(item.id) === String(applicationId),
        )
        if (!application) throw new Error('Application not found.')
        const ownsJob = (db.jobs ?? []).some(
            (job) => String(job.id) === String(application.job_id) && job.recruiter_id === getUserId(),
        )
        if (!ownsJob) throw new Error('Application not found.')
        if (application.status !== status) {
            application.status = status
            application.status_history ??= []
            application.status_history.push({
                status,
                changed_at: new Date().toISOString(),
            })
            writeDb(db)
        }
        return delay(application)
    }
    const data = await request(
        `/api/applications/${encodeURIComponent(applicationId)}/status`,
        { method: 'PATCH', body: { status } },
    )
    return data.application
}

export async function getRecruiterResumeDownload(applicationId) {
    if (USE_MOCK_API) {
        const db = readDb()
        const application = db.applications.find(
            (item) => String(item.id) === String(applicationId),
        )
        const ownsJob = (db.jobs ?? []).some(
            (job) =>
                String(job.id) === String(application?.job_id) &&
                job.recruiter_id === getUserId(),
        )
        if (!ownsJob) throw new Error('Application not found.')
        const resume = db.resumes?.find(
            (item) => String(item.id) === String(application?.resume_id),
        )
        if (!resume?.file_url) throw new Error('Resume file is unavailable.')
        return { file_name: resume.file_name, download_url: resume.file_url }
    }
    const data = await request(
        `/api/recruiter/applications/${encodeURIComponent(applicationId)}/resume`,
    )
    return data.resume
}
