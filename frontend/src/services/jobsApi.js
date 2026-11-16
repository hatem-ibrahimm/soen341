import { request, USE_MOCK_API } from './apiClient.js'
import { delay, MOCK_JOBS, readDb } from './mockStore.js'

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
        company_name: raw.company_name,
        company: raw.company_name,
        location: raw.location,
        type: raw.category,
        category: raw.category,
        salary: formatSalary(raw.min_salary, raw.max_salary),
        min_salary: raw.min_salary,
        max_salary: raw.max_salary,
        required_skills: raw.required_skills ?? [],
        status: raw.status,
        posted_at: raw.created_at,
        application_deadline: raw.application_deadline ?? null,
        description: raw.description,
    }
}

export async function listJobs() {
    if (USE_MOCK_API) {
        return delay(
            (readDb().jobs ?? MOCK_JOBS).filter(
                (job) => !job.status || job.status === 'published',
            ),
        )
    }
    const data = await request('/api/jobs')
    return (data.jobs ?? []).map(toJob)
}

export async function getJob(jobId) {
    if (USE_MOCK_API) {
        const job = (readDb().jobs ?? MOCK_JOBS).find((j) => j.id === jobId)
        if (!job || (job.status && job.status !== 'published')) {
            throw new Error('This job posting could not be found or is no longer open.')
        }
        return delay(job)
    }
    const data = await request(`/api/jobs/${jobId}`)
    return toJob(data.job)
}
