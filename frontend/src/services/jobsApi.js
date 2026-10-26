import { request, USE_MOCK_API } from './apiClient.js'
import { delay, MOCK_JOBS } from './mockStore.js'

// Owned by the Job Listing feature. Only getJob() is needed by the apply page.
//   GET /api/jobs        -> { jobs: [...] }
//   GET /api/jobs/<id>   -> { job }

export async function listJobs() {
    if (USE_MOCK_API) return delay(MOCK_JOBS)
    const data = await request('/api/jobs')
    return data.jobs
}

export async function getJob(jobId) {
    if (USE_MOCK_API) {
        const job = MOCK_JOBS.find((j) => j.id === jobId)
        if (!job) throw new Error('This job posting could not be found.')
        return delay(job)
    }
    const data = await request(`/api/jobs/${jobId}`)
    return data.job
}
