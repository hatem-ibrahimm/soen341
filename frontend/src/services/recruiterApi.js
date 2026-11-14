import { request, USE_MOCK_API } from './apiClient.js'
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
        }
        db.jobs = [...(db.jobs ?? MOCK_JOBS), job]
        writeDb(db)
        return delay(job)
    }

    const data = await request('/api/jobs', {
        method: 'POST',
        body: listing,
    })
    const job = toJob(data.job ?? data)

    if (!job?.id) {
        throw new Error('The server did not return the created job listing.')
    }

    return job
}