import { request, USE_MOCK_API } from './apiClient.js'
import { delay, MOCK_JOBS } from './mockStore.js'

// Job routes come from the Job Listing feature:
//   GET /api/jobs        -> { jobs: [...] }
//   GET /api/jobs/<id>   -> { job }
// The backend sends company_name, category, min_salary, max_salary, created_at.
// toJob() renames them to what our pages use: company, type, salary, posted_at.

function formatMoney(value) {
    return `$${Number(value).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`
}

function formatSalary(min, max) {
    if (min != null && max != null) return `${formatMoney(min)} – ${formatMoney(max)}`
    if (min != null) return `From ${formatMoney(min)}`
    if (max != null) return `Up to ${formatMoney(max)}`
    return ''
}

export function toJob(raw) {
    if (!raw) return null
    return {
        id: String(raw.id),
        title: raw.title,
        company: raw.company_name,
        location: raw.location,
        type: raw.category,
        category: raw.category,
        salary: formatSalary(raw.min_salary, raw.max_salary),
        posted_at: raw.created_at,
        description: raw.description,
    }
}

export async function listJobs() {
    if (USE_MOCK_API) return delay(MOCK_JOBS)
    const data = await request('/api/jobs')
    return (data.jobs ?? []).map(toJob)
}

export async function getJob(jobId) {
    if (USE_MOCK_API) {
        const job = MOCK_JOBS.find((j) => j.id === jobId)
        if (!job) throw new Error('This job posting could not be found.')
        return delay(job)
    }
    const data = await request(`/api/jobs/${jobId}`)
    return toJob(data.job)
}
