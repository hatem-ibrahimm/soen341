import { request, USE_MOCK_API } from './apiClient.js'
import { getUserId } from './session.js'
import { delay, MOCK_JOBS, newId, readDb, writeDb } from './mockStore.js'
import { toJob } from './jobsApi.js'

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